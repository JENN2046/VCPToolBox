# photo_studio Transport Convergence Decision

This file freezes the current transport decision for `photo_studio` on the clean engineering line in `A:\VCP\VCPToolBox-main`.

## Decision

For current implementation, the canonical transport is:

- `pluginType: synchronous`
- `communication.protocol: stdio`

`hybridservice + direct` is not the active implementation target for P0 or the immediate follow-on work on this branch.

## Why

### 1. The active execution path is stdio-first

`PluginManager.executePlugin` in [Plugin.js](A:\VCP\VCPToolBox-main\Plugin.js) directly validates spawned tool-style execution as:

- `pluginType === synchronous || asynchronous`
- `communication.protocol === stdio`

That is the exercised path used by the clean `photo_studio` implementation.

### 2. `direct` is a different runtime model

The loader treats `communication.protocol === direct` as a resident-plugin case and skips auto-reload for stability. That means `direct` is not a cosmetic manifest swap; it implies a different lifecycle, supervision, and reload model.

### 3. Current portability already favors stdio

[README_en.md](A:\VCP\VCPToolBox-main\README_en.md) states that distributed nodes currently support only `synchronous` `stdio` plugins.

### 4. The clean implementation and tests already exist on stdio

The accepted clean engineering anchor is commit `bd2410c` on `feature/photo-studio-p0-contract-alignment`. That line already contains:

- aligned business contract
- working manifests
- `tests/photo-studio`
- passing validation

Switching transport now would add runtime migration risk without solving a business-contract gap.

## Binding Rule

For current implementation:

- business schema authority remains the workspace source-of-truth freeze
- transport authority for the repository is this file

If transport wording elsewhere conflicts with this file, repository implementation should follow this file.

## Immediate Rule

Until a separate approved transport-migration batch exists:

- new `photo_studio` plugins and extensions should default to `synchronous + stdio`
- reviews should reject reintroduction of `hybridservice + direct` into the clean line
- transport migration must not be mixed into business schema alignment or release movement
