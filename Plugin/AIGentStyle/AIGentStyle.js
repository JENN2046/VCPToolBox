#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);
const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf
]);

const CONFIG = {
  datasetRoot: process.env.AIGENT_STYLE_DATASET_ROOT || path.join(__dirname, 'datasets'),
  outputRoot: process.env.AIGENT_STYLE_OUTPUT_ROOT || path.join(__dirname, 'outputs'),
  backend: process.env.AIGENT_STYLE_BACKEND || 'sd-scripts',
  defaultModel: process.env.AIGENT_STYLE_BASE_MODEL || 'flux-dev',
  allowTraining: String(process.env.AIGENT_STYLE_ALLOW_TRAINING || 'false').toLowerCase() === 'true'
};

function readJsonFromStdin() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('error', reject);
    process.stdin.on('end', () => {
      if (!input.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(input));
      } catch (error) {
        reject(new Error(`invalid json input: ${error.message}`));
      }
    });
  });
}

function normalizeName(value, fallback = 'style-dataset') {
  return String(value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80) || fallback;
}

function resolveInside(root, child) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, child || '');
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`path escapes configured root: ${child}`);
  }
  return resolved;
}

function walkImages(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const results = [];
  const stack = [directory];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const stat = fs.statSync(fullPath);
        results.push({
          path: fullPath,
          filename: entry.name,
          size_bytes: stat.size
        });
      }
    }
  }

  return results.sort((a, b) => a.path.localeCompare(b.path));
}

function getCaptionPath(imagePath, captionExtension = '.txt') {
  return path.join(
    path.dirname(imagePath),
    `${path.basename(imagePath, path.extname(imagePath))}${captionExtension}`
  );
}

function readCaption(imagePath, captionExtension = '.txt') {
  const captionPath = getCaptionPath(imagePath, captionExtension);
  if (!fs.existsSync(captionPath)) {
    return {
      path: captionPath,
      exists: false,
      text: ''
    };
  }

  return {
    path: captionPath,
    exists: true,
    text: fs.readFileSync(captionPath, 'utf8').trim()
  };
}

function readImageDimensions(imagePath) {
  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();

  try {
    if (ext === '.png' && buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
        format: 'png'
      };
    }

    if ((ext === '.jpg' || ext === '.jpeg') && buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) {
          offset += 1;
          continue;
        }

        const marker = buffer[offset + 1];
        const length = buffer.readUInt16BE(offset + 2);
        if (JPEG_SOF_MARKERS.has(marker)) {
          return {
            width: buffer.readUInt16BE(offset + 7),
            height: buffer.readUInt16BE(offset + 5),
            format: 'jpeg'
          };
        }

        offset += 2 + Math.max(length, 2);
      }
    }

    if (ext === '.bmp' && buffer.length >= 26 && buffer.toString('ascii', 0, 2) === 'BM') {
      return {
        width: Math.abs(buffer.readInt32LE(18)),
        height: Math.abs(buffer.readInt32LE(22)),
        format: 'bmp'
      };
    }

    if (ext === '.webp' && buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
      const chunk = buffer.toString('ascii', 12, 16);
      if (chunk === 'VP8X' && buffer.length >= 30) {
        return {
          width: 1 + buffer.readUIntLE(24, 3),
          height: 1 + buffer.readUIntLE(27, 3),
          format: 'webp'
        };
      }
      if (chunk === 'VP8 ' && buffer.length >= 30) {
        return {
          width: buffer.readUInt16LE(26) & 0x3fff,
          height: buffer.readUInt16LE(28) & 0x3fff,
          format: 'webp'
        };
      }
      if (chunk === 'VP8L' && buffer.length >= 25) {
        const bits = buffer.readUInt32LE(21);
        return {
          width: (bits & 0x3fff) + 1,
          height: ((bits >> 14) & 0x3fff) + 1,
          format: 'webp'
        };
      }
    }
  } catch (error) {
    return {
      width: null,
      height: null,
      format: ext.replace('.', '') || 'unknown',
      error: error.message
    };
  }

  return {
    width: null,
    height: null,
    format: ext.replace('.', '') || 'unknown',
    error: 'unsupported or invalid image header'
  };
}

function inferScenario(text) {
  const value = String(text || '').toLowerCase();
  if (/anime|二次元|角色|game|游戏/.test(value)) {
    return 'anime';
  }
  if (/portrait|人像|写真|头像/.test(value)) {
    return 'portrait';
  }
  if (/ecommerce|product|电商|服装|fashion|model|模特/.test(value)) {
    return 'ecommerce';
  }
  return 'general';
}

function recommendTrainingParams({ imageCount, scenario, model }) {
  const safeCount = Math.max(0, Number(imageCount) || 0);
  const repeats = safeCount < 20 ? 12 : safeCount < 40 ? 8 : 5;
  const maxTrainSteps = Math.max(400, Math.min(2400, safeCount * repeats * 8));
  const resolution = scenario === 'portrait' ? 768 : 1024;

  return {
    backend: CONFIG.backend,
    base_model: model || CONFIG.defaultModel,
    network_module: 'lora',
    resolution,
    train_batch_size: safeCount >= 30 ? 2 : 1,
    learning_rate: scenario === 'anime' ? 0.0001 : 0.00008,
    text_encoder_lr: 0.00004,
    unet_lr: scenario === 'anime' ? 0.0001 : 0.00008,
    repeats,
    max_train_steps: maxTrainSteps,
    save_every_n_steps: Math.max(100, Math.floor(maxTrainSteps / 4)),
    mixed_precision: 'bf16',
    caption_extension: '.txt'
  };
}

function buildDatasetPlan(request) {
  const datasetName = normalizeName(request.dataset_name || request.name);
  const datasetPath = request.dataset_path
    ? path.resolve(String(request.dataset_path))
    : resolveInside(CONFIG.datasetRoot, datasetName);
  const outputPath = resolveInside(CONFIG.outputRoot, datasetName);
  const images = walkImages(datasetPath);
  const scenario = inferScenario(`${request.scenario || ''} ${request.description || ''} ${datasetName}`);
  const params = recommendTrainingParams({
    imageCount: images.length,
    scenario,
    model: request.base_model
  });

  return {
    dataset_name: datasetName,
    scenario,
    dataset_path: datasetPath,
    output_path: outputPath,
    image_count: images.length,
    images,
    recommended_params: params,
    readiness: {
      ok: images.length >= 15,
      minimum_images: 15,
      recommended_images: '15-50',
      warnings: [
        ...(images.length === 0 ? ['dataset directory has no supported images'] : []),
        ...(images.length > 0 && images.length < 15 ? ['dataset has fewer than 15 images'] : []),
        ...(!CONFIG.allowTraining ? ['training execution disabled; dry-run only'] : [])
      ]
    }
  };
}

function buildDryRunCommand(plan) {
  return {
    executable: CONFIG.backend,
    dry_run: true,
    args: {
      dataset_path: plan.dataset_path,
      output_path: plan.output_path,
      base_model: plan.recommended_params.base_model,
      resolution: plan.recommended_params.resolution,
      learning_rate: plan.recommended_params.learning_rate,
      max_train_steps: plan.recommended_params.max_train_steps,
      caption_extension: plan.recommended_params.caption_extension
    }
  };
}

function buildPreprocessPlan(plan) {
  const targetResolution = plan.recommended_params.resolution;
  const dimensionItems = plan.images
    .map((image) => image.dimensions)
    .filter((dimensions) => dimensions && dimensions.width && dimensions.height);
  const resizeNeeded = dimensionItems.filter((dimensions) => {
    return dimensions.width !== targetResolution || dimensions.height !== targetResolution;
  }).length;

  return {
    dry_run: true,
    target_resolution: targetResolution,
    image_count: plan.images.length,
    dimension_count: dimensionItems.length,
    resize_or_bucket_count: resizeNeeded,
    operations: [
      {
        name: 'validate_images',
        description: 'Check supported image extensions and readable files',
        status: 'planned'
      },
      {
        name: 'caption_check',
        description: `Check caption files with extension ${plan.recommended_params.caption_extension}`,
        status: 'planned'
      },
      {
        name: 'resize_or_bucket',
        description: `Prepare resize/bucket plan for ${targetResolution}px training (${resizeNeeded} images need resize/bucket review)`,
        status: 'planned'
      }
    ]
  };
}

function buildDatasetManifest(request) {
  const plan = buildDatasetPlan(request);
  const captionExtension = plan.recommended_params.caption_extension;
  const items = plan.images.map((image, index) => {
    const caption = readCaption(image.path, captionExtension);
    const dimensions = readImageDimensions(image.path);
    return {
      id: `${plan.dataset_name}-${String(index + 1).padStart(4, '0')}`,
      image_path: image.path,
      filename: image.filename,
      size_bytes: image.size_bytes,
      dimensions,
      caption_path: caption.path,
      caption_exists: caption.exists,
      caption: caption.text
    };
  });
  const missingCaptions = items.filter((item) => !item.caption_exists || !item.caption);
  const unreadableDimensions = items.filter((item) => !item.dimensions.width || !item.dimensions.height);
  const imagesWithDimensions = items.map((item) => ({
    path: item.image_path,
    filename: item.filename,
    size_bytes: item.size_bytes,
    dimensions: item.dimensions
  }));
  const planForPreprocess = {
    ...plan,
    images: imagesWithDimensions
  };

  return {
    dataset_name: plan.dataset_name,
    scenario: plan.scenario,
    dataset_path: plan.dataset_path,
    output_path: plan.output_path,
    image_count: plan.image_count,
    caption_extension: captionExtension,
    missing_caption_count: missingCaptions.length,
    readiness: {
      ...plan.readiness,
      ok: plan.readiness.ok && missingCaptions.length === 0,
      warnings: [
        ...plan.readiness.warnings,
        ...(missingCaptions.length > 0 ? [`${missingCaptions.length} images are missing captions`] : []),
        ...(unreadableDimensions.length > 0 ? [`${unreadableDimensions.length} images have unreadable dimensions`] : [])
      ]
    },
    preprocess_plan: buildPreprocessPlan(planForPreprocess),
    recommended_params: plan.recommended_params,
    items
  };
}

function maybeWriteManifest(manifest, request) {
  if (request.write_manifest !== true) {
    return {
      written: false,
      path: null
    };
  }

  const outputPath = resolveInside(CONFIG.outputRoot, manifest.dataset_name);
  fs.mkdirSync(outputPath, { recursive: true });
  const manifestPath = path.join(outputPath, 'dataset-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return {
    written: true,
    path: manifestPath
  };
}

function buildTrainingJobManifest(request) {
  const datasetManifest = buildDatasetManifest(request);
  const command = buildDryRunCommand({
    dataset_path: datasetManifest.dataset_path,
    output_path: datasetManifest.output_path,
    recommended_params: datasetManifest.recommended_params
  });
  const jobId = normalizeName(request.job_id || `${datasetManifest.dataset_name}-dry-run`);

  return {
    job_id: jobId,
    dataset_name: datasetManifest.dataset_name,
    scenario: datasetManifest.scenario,
    status: 'planned',
    dry_run: true,
    created_at: new Date().toISOString(),
    dataset_manifest: datasetManifest,
    command,
    stages: [
      {
        name: 'preprocess',
        status: 'planned',
        dry_run: true,
        operations: datasetManifest.preprocess_plan.operations
      },
      {
        name: 'train',
        status: CONFIG.allowTraining ? 'blocked_until_explicit_execution' : 'disabled',
        dry_run: true,
        backend: CONFIG.backend
      },
      {
        name: 'evaluate',
        status: 'planned',
        dry_run: true,
        note: 'QualityInspector integration will be added in a later stage'
      }
    ],
    safety: {
      real_training_executed: false,
      allow_training: CONFIG.allowTraining,
      requires_explicit_training_stage: true
    }
  };
}

function maybeWriteJobManifest(job, request) {
  if (request.write_job_manifest !== true) {
    return {
      written: false,
      path: null
    };
  }

  const outputPath = resolveInside(CONFIG.outputRoot, job.dataset_name);
  fs.mkdirSync(outputPath, { recursive: true });
  const jobPath = path.join(outputPath, 'training-job-manifest.json');
  fs.writeFileSync(jobPath, `${JSON.stringify(job, null, 2)}\n`, 'utf8');
  return {
    written: true,
    path: jobPath
  };
}

async function handleRequest(request) {
  const action = String(request.action || request.tool_name || '').trim();

  switch (action) {
    case 'prepare_dataset':
    case 'PrepareDataset': {
      const plan = buildDatasetPlan(request);
      return {
        status: 'success',
        result: plan
      };
    }

    case 'recommend_params':
    case 'RecommendParams': {
      const scenario = inferScenario(request.scenario || request.description);
      return {
        status: 'success',
        result: recommendTrainingParams({
          imageCount: request.image_count,
          scenario,
          model: request.base_model
        })
      };
    }

    case 'dry_run_train':
    case 'DryRunTrain': {
      const plan = buildDatasetPlan(request);
      return {
        status: 'success',
        result: {
          plan,
          command: buildDryRunCommand(plan),
          safety: {
            real_training_executed: false,
            requires_allow_training: true,
            allow_training: CONFIG.allowTraining
          }
        }
      };
    }

    case 'build_manifest':
    case 'BuildManifest': {
      const manifest = buildDatasetManifest(request);
      const write = maybeWriteManifest(manifest, request);
      return {
        status: 'success',
        result: {
          manifest,
          write
        }
      };
    }

    case 'build_training_job':
    case 'BuildTrainingJob': {
      const job = buildTrainingJobManifest(request);
      const write = maybeWriteJobManifest(job, request);
      return {
        status: 'success',
        result: {
          job,
          write
        }
      };
    }

    case 'health_check':
    case 'HealthCheck':
      return {
        status: 'success',
        result: {
          dataset_root: CONFIG.datasetRoot,
          output_root: CONFIG.outputRoot,
          backend: CONFIG.backend,
          default_model: CONFIG.defaultModel,
          allow_training: CONFIG.allowTraining,
          supported_image_extensions: Array.from(IMAGE_EXTENSIONS)
        }
      };

    default:
      return {
        status: 'error',
        error: `unknown action: ${action || '(empty)'}`,
        supported_actions: ['prepare_dataset', 'recommend_params', 'dry_run_train', 'build_manifest', 'build_training_job', 'health_check']
      };
  }
}

async function main() {
  try {
    const request = await readJsonFromStdin();
    const response = await handleRequest(request);
    process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'error', error: error.message })}\n`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  handleRequest,
  buildDatasetPlan,
  buildDryRunCommand,
  buildDatasetManifest,
  buildPreprocessPlan,
  buildTrainingJobManifest,
  readImageDimensions,
  recommendTrainingParams,
  inferScenario
};
