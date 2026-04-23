# Photo Studio Baserow Provider Batch (2026-04-23)

## Summary

This note scopes the current repo-local change batch that adds the first `photo_studio` Baserow provider path behind the existing export and delivery queue model.

This batch is intentionally narrow:

- keep `target_type = sheet`
- persist `target_provider`
- make `sheet` export identities provider-aware
- add one dedicated `BaserowPublishAdapter`
- route live publish by `record.target_provider`
- keep dry-run and live behavior explicit

The authoritative governance notes for this batch live outside this repo under `A:\VCP\docs`.

## Repo Write Set

Code and tests in this repo:

- `plugins/custom/reporting/sync_to_external_sheet_or_notion/src/index.js`
- `plugins/custom/shared/photo_studio_data/ExternalPublishAdapter.js`
- `plugins/custom/shared/photo_studio_data/BaserowPublishAdapter.js`
- `tests/photo-studio/external-sync.test.js`
- `tests/photo-studio/delivery-queue.test.js`

This note exists so the repo commit is still self-describing even though the wider governance documents are stored in `A:\VCP\docs`.

## Contract Decisions

### Export contract

For `sheet` exports:

- `target_provider` is now explicit and persisted
- `target_provider` is included in `export_key`
- new `sheet` exports default to `dingtalk_ai_table` when omitted
- supported explicit providers in this batch are:
  - `dingtalk_ai_table`
  - `baserow`

### Live routing contract

`ExternalPublishAdapter` now routes `sheet` records by `record.target_provider`:

- `baserow` -> `BaserowPublishAdapter`
- `dingtalk_ai_table` -> `DingTalkAITablePublishAdapter`
- missing legacy provider -> bounded compatibility fallback to `dingtalk_ai_table`
- unsupported provider -> bounded `unsupported_live_target` no-op result

### Baserow live config surface

The first Baserow adapter batch is intentionally narrow:

- `BaserowApiUrl`
- `BaserowApiToken`
- `BaserowTableId`
- `BaserowFieldMap`

`BaserowFieldMap` supports:

- record paths
- literal string fallback values
- primitive literals
- `{ path: ... }`
- `{ value: ... }`

## Validation In Repo

Targeted validation for the code batch:

- `npm run test:photo-studio`

Expected coverage added in this batch:

- provider-aware `sheet` export identity
- explicit Baserow `dry_run`
- explicit Baserow `live`
- missing Baserow config degradation
- provider routing separation from DingTalk

## Operator Acceptance Snapshot

This repo batch has already been exercised against a real Baserow destination outside the unit tests.

Accepted first live target:

- API base:
  - `https://api.baserow.io`
- table:
  - `942221` (`Companies`)
- first live field map:
  - `Name <- export_rows.0.customer_name`
  - `Notes <- export_text`

Observed first bounded live result:

- `activation_status = live_published`
- `delivery_receipt_id = 5`
- remote row read-back succeeded

The authoritative acceptance and governance notes for that run remain in `A:\VCP\docs`.

## Important Operator Note

The API token used during the first live acceptance was supplied through chat.

Treat that token as exposed:

1. rotate it
2. do not treat it as the durable long-term token
3. rerun bounded dry-run/live checks with a fresh runtime-local token before sustained use

## Out Of Scope

This repo batch does not include:

- generic multi-provider redesign
- schema creation
- multi-table orchestration
- batch publish
- queue workers
- release movement

## Practical Commit Intent

If committed, this batch should be described as:

- explicit Baserow provider support for `photo_studio` `sheet` exports
- provider-aware export identities
- explicit live routing and degraded behavior
- focused test expansion
- repo-local note pointing to external governance/acceptance docs
