# P3-F-D Inventory CLI Hardening

Date: 2026-06-10

Status: helper/test/doc hardening patch

## 1. Purpose

P3-F-D hardens the path-only external ecosystem inventory helper after P3-F-C.

The goal is to keep governance evidence explicit when CLI input is invalid or
when inventory traversal is truncated. This patch does not change runtime
loading, migration behavior, Plugin Store behavior, Admin APIs, or Agent loading.

## 2. Scope

Changed files:

- `scripts/p3-external-ecosystem-inventory.js`
- `tests/p3-external-ecosystem-inventory.test.js`
- `docs/governance/P3F_INVENTORY_CLI_HARDENING_20260610.md`

The helper remains path-only and does not read ordinary file contents.

## 3. Implemented Hardening

CLI fail-closed behavior:

- `--root` without a following value exits with code 2;
- `--root --summary` exits with code 2 instead of scanning an unintended path;
- unknown CLI arguments exit with code 2;
- `--max-entries` without a positive integer exits with code 2.

Traversal metadata:

- `buildInventory()` now exposes top-level `truncated` and `limit`;
- `summary` now exposes `truncated` and `limit`;
- summary-only CLI output includes top-level and nested truncation metadata;
- `--max-entries` is available for bounded review probes.

## 4. Safety Notes

P3-F-D preserves existing safety ordering:

- real `.env` / `config.env` paths remain blocked;
- secret-like paths remain blocked;
- key material remains blocked;
- path-only traversal still does not read file contents;
- symlinks are still recorded as path entries and are not recursively followed.

The inventory output remains operator-internal evidence by default. It may expose
relative path metadata, even though it does not expose file contents.

## 5. Test Coverage

Added or updated tests cover:

- `summarizeRecords()` includes truncation metadata;
- `buildInventory()` marks small `maxEntries` scans as truncated;
- CLI summary output includes default non-truncated metadata;
- CLI fails closed on missing `--root`, `--root --summary`, unknown flags, and
  invalid `--max-entries`;
- CLI summary output reports explicit truncation when `--max-entries` is small.

## 6. Non-Goals

P3-F-D does not:

- move, copy, delete, or migrate files;
- change Plugin loading;
- change Plugin Store behavior;
- change Admin APIs;
- add Agent external directory loading;
- create or trust an external ecosystem root;
- read or print real `.env`, `config.env`, or plugin `config.env` contents;
- run install, upload, uninstall, server, or API probes.

## 7. Closeout Checklist

- [x] Missing `--root` value fails closed.
- [x] Unknown CLI args fail closed.
- [x] `--max-entries` is explicit and validated.
- [x] Truncated scans are marked in inventory and summary output.
- [x] Existing P3-F taxonomy behavior remains covered.
- [x] No migration permission granted.
- [x] No real secrets read or printed.
