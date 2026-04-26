# AI Image Agents Stage 6 Handoff

**Date**: 2026-04-26
**Branch**: `prod/stable`
**Scope**: AI image agents stage 3-6 handoff and production boundary review

## Summary

Stages 3-5 have been implemented as dry-run safe building blocks:

- `Plugin/AIGentStyle`: StyleTrainer preparation, dataset manifest, caption drafts, training job preflight.
- `Plugin/AIGentQuality`: QualityInspector prototype, structured scoring, retry routing.
- `Plugin/AIGentOrchestrator`: multi-agent planning, retry planning, orchestration contracts, state/audit plan shapes.

Stage 6 records the current boundary: the system can plan, inspect and route, but it does not execute real generation, real training, external vision inspection or retry loops.

## Completed Components

### StyleTrainer

- `PrepareDataset`
- `RecommendParams`
- `DryRunTrain`
- `BuildManifest`
- `BuildTrainingJob`
- `GenerateCaptionDrafts`
- `ExecuteTrainingJob`

Safety gates:

- `AIGENT_STYLE_ALLOW_TRAINING=false` by default.
- real training is not spawned.
- caption writes require `write_captions=true`.
- training execution requires explicit future stage work.

### QualityInspector

- `InspectImage`
- `InspectBatch`
- `BuildRetryPlan`
- `HealthCheck`

Safety gates:

- `AIGENT_QUALITY_EXTERNAL_VISION=false` by default.
- no CLIP, OCR, OpenPose, moderation API or external vision model call.
- retry output is advice only.

### Multi-Agent Orchestrator

- `PlanImagePipeline`
- `PlanRetryPipeline`
- `HealthCheck`

Safety gates:

- `AIGENT_ORCHESTRATOR_ALLOW_EXECUTION=false` by default.
- plans include `state_plan` and `audit_plan`, but no audit logs are written.
- downstream plugins are not invoked by the orchestrator.

## Contracts

Stable handoff documents:

- `docs/AI_IMAGE_QUALITY_CONTRACT.md`
- `docs/AI_IMAGE_ORCHESTRATION_CONTRACT.md`

Consumers should treat outputs as proposals unless a future execution stage explicitly adds and validates real execution APIs.

## Validation Run

Validated on 2026-04-26:

- `node --check Plugin/AIGentStyle/AIGentStyle.js`
- `node --check Plugin/AIGentQuality/AIGentQuality.js`
- `node --check Plugin/AIGentOrchestrator/AIGentOrchestrator.js`
- manifest JSON parse for:
  - `Plugin/AIGentStyle/plugin-manifest.json`
  - `Plugin/AIGentQuality/plugin-manifest.json`
  - `Plugin/AIGentOrchestrator/plugin-manifest.json`

Previously validated during stage implementation:

- StyleTrainer dataset manifest dry-run.
- StyleTrainer image dimension parsing.
- StyleTrainer caption draft dry-run and optional local caption write.
- StyleTrainer training execution preflight blocker behavior.
- QualityInspector single-image and batch inspection.
- QualityInspector structured retry plan.
- Orchestrator image pipeline and retry pipeline planning.
- Orchestrator state/audit plan output.

## Not Validated

The following were intentionally not validated because they require a later confirmed execution stage or external dependencies:

- real ComfyUI generation.
- real StyleTrainer / LoRA training.
- dependency installation for SD-Scripts or Flux tooling.
- CLIP/OCR/OpenPose/moderation provider inspection.
- external API calls.
- UI integration for approval or audit display.
- persisted audit logs.

## Production Boundary

Current production-safe use:

- dry-run planning.
- local file/dimension inspection.
- contract review.
- retry/manual-review proposal generation.

Not production-enabled:

- real image generation.
- real LoRA training.
- automatic retry execution.
- external content moderation.
- image upload or remote storage.

## Required Gates For Future Real Execution

Before real downstream execution is added, require:

- explicit user confirmation for the stage.
- environment allow gate set to true for the relevant plugin.
- request-level confirmation flags.
- explicit output directory.
- audit record design reviewed for secrets and image payload handling.
- rollback or cleanup plan for generated artifacts.
- validation that user-owned data and `config.env` secrets are not logged.

## Remaining Risks

- rule-based quality checks are incomplete and cannot detect anatomy, OCR errors or aesthetic failures with model accuracy.
- orchestrator does not resolve live plugin availability.
- retry plans are not connected to real workflow execution.
- state/audit plans are not persisted.
- AdminPanel UI does not yet expose these stage 3-5 capabilities.

## Recommended Next Stage

Choose one of these paths:

1. Add AdminPanel read-only views for StyleTrainer, QualityInspector and Orchestrator dry-run outputs.
2. Add a local-only execution harness behind explicit gates for orchestrator step simulation.
3. Add model-backed QualityInspector checks as a separately confirmed integration stage.
4. Stop here for a stable dry-run milestone and perform broader repository validation.
