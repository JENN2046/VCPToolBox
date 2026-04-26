#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);
const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf
]);

const CONFIG = {
  minimumWidth: Number(process.env.AIGENT_QUALITY_MIN_WIDTH || 512),
  minimumHeight: Number(process.env.AIGENT_QUALITY_MIN_HEIGHT || 512),
  maxFileSizeMb: Number(process.env.AIGENT_QUALITY_MAX_FILE_SIZE_MB || 50),
  externalVisionEnabled: String(process.env.AIGENT_QUALITY_EXTERNAL_VISION || 'false').toLowerCase() === 'true'
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

function walkImages(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const results = [];
  const stack = [directory];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
  }

  return results.sort((a, b) => a.localeCompare(b));
}

function scoreFromFindings(findings) {
  const penalty = findings.reduce((total, finding) => {
    if (finding.severity === 'critical') {
      return total + 40;
    }
    if (finding.severity === 'major') {
      return total + 18;
    }
    if (finding.severity === 'minor') {
      return total + 7;
    }
    return total + 3;
  }, 0);

  return Math.max(0, Math.min(100, 100 - penalty));
}

function verdictFromScore(score) {
  if (score >= 85) {
    return 'pass';
  }
  if (score >= 65) {
    return 'review';
  }
  return 'reject';
}

function inspectImage(request) {
  const imagePath = path.resolve(String(request.image_path || request.path || ''));
  const findings = [];

  if (!imagePath || imagePath === path.parse(imagePath).root) {
    throw new Error('image_path is required');
  }
  if (!fs.existsSync(imagePath)) {
    throw new Error(`image not found: ${imagePath}`);
  }

  const stat = fs.statSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) {
    findings.push({
      id: 'unsupported_extension',
      severity: 'critical',
      dimension: 'file_integrity',
      message: `unsupported image extension: ${ext || '(none)'}`
    });
  }

  const dimensions = readImageDimensions(imagePath);
  if (!dimensions.width || !dimensions.height) {
    findings.push({
      id: 'unreadable_dimensions',
      severity: 'major',
      dimension: 'file_integrity',
      message: dimensions.error || 'image dimensions could not be read'
    });
  } else {
    if (dimensions.width < CONFIG.minimumWidth || dimensions.height < CONFIG.minimumHeight) {
      findings.push({
        id: 'low_resolution',
        severity: 'major',
        dimension: 'technical_quality',
        message: `image is below ${CONFIG.minimumWidth}x${CONFIG.minimumHeight}`
      });
    }

    const aspectRatio = dimensions.width / dimensions.height;
    if (aspectRatio > 3 || aspectRatio < 0.33) {
      findings.push({
        id: 'extreme_aspect_ratio',
        severity: 'minor',
        dimension: 'composition',
        message: `extreme aspect ratio ${aspectRatio.toFixed(2)} may need manual review`
      });
    }
  }

  const maxBytes = CONFIG.maxFileSizeMb * 1024 * 1024;
  if (stat.size > maxBytes) {
    findings.push({
      id: 'large_file',
      severity: 'minor',
      dimension: 'file_integrity',
      message: `file is larger than ${CONFIG.maxFileSizeMb}MB`
    });
  }

  const prompt = String(request.prompt || request.caption || '').toLowerCase();
  if (/\b(logo|trademark|copyright|watermark)\b/.test(prompt)) {
    findings.push({
      id: 'compliance_keyword_review',
      severity: 'minor',
      dimension: 'compliance',
      message: 'prompt/caption contains brand or copyright review keywords'
    });
  }

  if (!CONFIG.externalVisionEnabled) {
    findings.push({
      id: 'vision_model_not_enabled',
      severity: 'info',
      dimension: 'validation_limit',
      message: 'rule-based prototype only; no external vision model was called'
    });
  }

  const score = scoreFromFindings(findings);
  return {
    image_path: imagePath,
    filename: path.basename(imagePath),
    dry_run: true,
    dimensions,
    size_bytes: stat.size,
    score,
    verdict: verdictFromScore(score),
    findings,
    recommendations: buildRecommendations(findings)
  };
}

function buildRecommendations(findings) {
  const ids = new Set(findings.map((finding) => finding.id));
  return [
    ...(ids.has('low_resolution') ? ['regenerate at a higher resolution or use an upscale workflow'] : []),
    ...(ids.has('unreadable_dimensions') ? ['verify the image file is complete and supported'] : []),
    ...(ids.has('extreme_aspect_ratio') ? ['review crop/bucket settings before publishing'] : []),
    ...(ids.has('compliance_keyword_review') ? ['send the image through manual brand/copyright review'] : []),
    ...(ids.has('vision_model_not_enabled') ? ['enable a later confirmed vision-model stage for anatomy/OCR/aesthetic scoring'] : [])
  ];
}

function inspectBatch(request) {
  const directory = path.resolve(String(request.directory || request.dataset_path || ''));
  if (!directory || directory === path.parse(directory).root) {
    throw new Error('directory or dataset_path is required');
  }
  if (!fs.existsSync(directory)) {
    throw new Error(`directory not found: ${directory}`);
  }

  const images = walkImages(directory);
  const reports = images.map((imagePath) => inspectImage({
    ...request,
    image_path: imagePath
  }));
  const score = reports.length
    ? Math.round(reports.reduce((total, report) => total + report.score, 0) / reports.length)
    : 0;
  const verdictCounts = reports.reduce((counts, report) => {
    counts[report.verdict] = (counts[report.verdict] || 0) + 1;
    return counts;
  }, {});

  return {
    directory,
    dry_run: true,
    image_count: images.length,
    average_score: score,
    verdict: verdictFromScore(score),
    verdict_counts: verdictCounts,
    reports
  };
}

async function handleRequest(request) {
  const action = String(request.action || request.tool_name || '').trim();

  switch (action) {
    case 'inspect_image':
    case 'InspectImage':
      return {
        status: 'success',
        result: inspectImage(request)
      };

    case 'inspect_batch':
    case 'InspectBatch':
      return {
        status: 'success',
        result: inspectBatch(request)
      };

    case 'health_check':
    case 'HealthCheck':
      return {
        status: 'success',
        result: {
          minimum_width: CONFIG.minimumWidth,
          minimum_height: CONFIG.minimumHeight,
          max_file_size_mb: CONFIG.maxFileSizeMb,
          external_vision_enabled: CONFIG.externalVisionEnabled,
          supported_image_extensions: Array.from(IMAGE_EXTENSIONS)
        }
      };

    default:
      return {
        status: 'error',
        error: `unknown action: ${action || '(empty)'}`,
        supported_actions: ['inspect_image', 'inspect_batch', 'health_check']
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
  inspectImage,
  inspectBatch,
  readImageDimensions,
  scoreFromFindings,
  verdictFromScore
};
