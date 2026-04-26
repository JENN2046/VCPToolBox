#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);

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
        supported_actions: ['prepare_dataset', 'recommend_params', 'dry_run_train', 'health_check']
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
  recommendTrainingParams,
  inferScenario
};
