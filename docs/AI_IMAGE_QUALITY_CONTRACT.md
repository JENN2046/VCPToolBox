# AI Image Quality Contract

**Date**: 2026-04-26
**Owner plugin**: `Plugin/AIGentQuality`
**Stage**: QualityInspector contract, dry-run only

This document defines the stable contract between `AIGentQuality` and later workflow or multi-agent orchestration layers.

## Safety Boundary

- `AIGentQuality` does not upload images.
- `AIGentQuality` does not invoke `AIGentWorkflow`.
- `AIGentQuality` does not regenerate images.
- `AIGentQuality` does not call CLIP, OCR, OpenPose, moderation APIs or external vision models in the current stage.
- `BuildRetryPlan` returns routing advice only. It is not an execution command.

Any future real retry, external model inspection or moderation provider call must be implemented as a separate confirmed stage with an explicit safety gate.

## Commands

### InspectImage

Input:

```json
{
  "tool_name": "InspectImage",
  "image_path": "A:/path/to/image.png",
  "caption": "optional prompt or caption text"
}
```

Output shape:

```json
{
  "image_path": "absolute path",
  "filename": "image.png",
  "dry_run": true,
  "dimensions": {
    "width": 1024,
    "height": 1024,
    "format": "png"
  },
  "size_bytes": 12345,
  "score": 93,
  "verdict": "pass",
  "dimension_scores": {},
  "findings": [],
  "recommendations": [],
  "workflow_advice": {}
}
```

### InspectBatch

Input:

```json
{
  "tool_name": "InspectBatch",
  "directory": "A:/path/to/generated-images"
}
```

Output shape:

```json
{
  "directory": "absolute path",
  "dry_run": true,
  "image_count": 2,
  "average_score": 88,
  "verdict": "pass",
  "verdict_counts": {
    "pass": 1,
    "review": 1
  },
  "retry_queue": [],
  "reports": []
}
```

### BuildRetryPlan

Input can target either a single image or a directory:

```json
{
  "tool_name": "BuildRetryPlan",
  "directory": "A:/path/to/generated-images"
}
```

Output shape:

```json
{
  "dry_run": true,
  "source": "batch",
  "overall_verdict": "review",
  "retry_count": 1,
  "retry_queue": [],
  "safety": {
    "real_generation_retried": false,
    "workflow_invoked": false,
    "external_service_called": false
  },
  "report": {}
}
```

## Verdict Semantics

- `pass`: image or batch can continue to downstream use.
- `review`: image or batch needs manual review or non-destructive workflow adjustment.
- `reject`: image or batch should not be published without regeneration or operator review.

Score thresholds:

- `pass`: `score >= 85`
- `review`: `65 <= score < 85`
- `reject`: `score < 65`

## Dimension Scores

`dimension_scores` is an object keyed by quality dimension.

Stable dimensions:

- `technical_quality`: resolution and future blur/noise checks.
- `composition`: aspect ratio, crop and future layout checks.
- `compliance`: brand/copyright/safety review signals.
- `file_integrity`: extension, header readability and file-size checks.
- `validation_limit`: explicit limits of the current inspection stage.

Each dimension has this shape:

```json
{
  "score": 93,
  "finding_count": 1,
  "status": "pass"
}
```

## Findings

Each finding has this shape:

```json
{
  "id": "low_resolution",
  "severity": "major",
  "dimension": "technical_quality",
  "message": "image is below 512x512"
}
```

Stable severities:

- `critical`: file or policy issue that blocks normal use.
- `major`: likely quality failure.
- `minor`: review-worthy issue.
- `info`: validation limit or informational note.

## Workflow Advice

`workflow_advice` is the handoff surface for `AIGentWorkflow` and future multi-agent orchestration.

Shape:

```json
{
  "route": "manual_review",
  "actions": [
    {
      "action": "retry_generation",
      "priority": "medium",
      "reason": "regenerate or upscale with a higher target resolution",
      "suggested_overrides": {
        "width": 512,
        "height": 512
      }
    }
  ]
}
```

Stable routes:

- `accept`: downstream may continue.
- `manual_review`: operator review is recommended before publish or retry.
- `retry_or_reject`: regeneration or rejection should be considered.

Stable actions:

- `accept`
- `manual_review`
- `manual_compliance_review`
- `retry_generation`
- `adjust_workflow`

## Retry Queue

`retry_queue` contains only non-pass items.

Shape:

```json
{
  "image_path": "absolute path",
  "filename": "image.png",
  "verdict": "review",
  "score": 75,
  "route": "manual_review",
  "actions": []
}
```

Consumers must treat `retry_queue` as advice, not authorization to regenerate.

## Consumer Rules

Workflow or orchestration consumers should:

- accept `pass` items without changing generation parameters.
- route `manual_review` to human review or a future confirmed review agent.
- route `retry_generation` to a dry-run retry proposal first.
- never invoke generation directly from `BuildRetryPlan` output without a separate execution gate.
- preserve the original report in audit logs when retrying or rejecting.

## Known Limits

- No pixel-level anatomy inspection.
- No OCR.
- No CLIP or aesthetic embedding score.
- No real brand/logo detection.
- No moderation-provider verdict.
- Rule-based checks are deterministic but incomplete.
