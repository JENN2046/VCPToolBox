# AIGentQuality - QualityInspector

**Version**: 0.1.0
**Stage**: QualityInspector prototype
**Safety boundary**: rule-based dry-run only; no external vision model, no OCR service and no real moderation provider call.

## Goal

AIGentQuality starts stage 4 of the AI image agent plan. It gives the pipeline a local quality gate that can inspect generated images before later human review, retry orchestration or model-based inspection.

Current prototype checks:

- supported file extension
- readable PNG/JPEG/WebP/BMP dimensions
- minimum resolution
- extreme aspect ratio
- large file size
- brand/copyright review keywords in prompt or caption

It returns a score, verdict and recommendations. It does not claim to detect anatomy, OCR, watermark pixels or aesthetic quality with model accuracy yet.
Reports now include dimension scores for `technical_quality`, `composition`, `compliance`, `file_integrity` and `validation_limit`, plus workflow advice for accept/retry/manual-review routing.

Stable output semantics for downstream workflow and multi-agent consumers are documented in `docs/AI_IMAGE_QUALITY_CONTRACT.md`.

## Commands

### InspectImage

```text
<<<[TOOL_REQUEST]>>>
maid:「始」AIGentQuality「末」
tool_name:「始」InspectImage「末」
image_path:「始」A:/path/to/image.png「末」
caption:「始」product photo, clean background「末」
<<<[END_TOOL_REQUEST]>>>
```

### InspectBatch

```text
<<<[TOOL_REQUEST]>>>
maid:「始」AIGentQuality「末」
tool_name:「始」InspectBatch「末」
directory:「始」A:/path/to/generated-images「末」
<<<[END_TOOL_REQUEST]>>>
```

### BuildRetryPlan

Build a dry-run retry/manual-review plan from a single image or a directory. This does not invoke `AIGentWorkflow` or regenerate anything.

```text
<<<[TOOL_REQUEST]>>>
maid:「始」AIGentQuality「末」
tool_name:「始」BuildRetryPlan「末」
directory:「始」A:/path/to/generated-images「末」
<<<[END_TOOL_REQUEST]>>>
```

### HealthCheck

```text
<<<[TOOL_REQUEST]>>>
maid:「始」AIGentQuality「末」
tool_name:「始」HealthCheck「末」
<<<[END_TOOL_REQUEST]>>>
```

## Verdicts

- `pass`: score >= 85
- `review`: score >= 65 and < 85
- `reject`: score < 65

## Safety Notes

- `AIGENT_QUALITY_EXTERNAL_VISION=false` is the stage 4 default.
- The plugin does not upload images anywhere.
- The plugin does not call CLIP, OCR, OpenPose or moderation APIs.
- Model-backed inspection should be added as a later, explicitly confirmed stage.
