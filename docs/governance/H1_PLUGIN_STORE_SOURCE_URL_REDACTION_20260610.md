# H1 Plugin Store Source URL Redaction

Date: 2026-06-10

Status: hardening implementation

## 1. Purpose

This H1 hardening patch prevents Plugin Store source URLs from being displayed
with credential metadata in the AdminPanel UI.

Before this patch, the source management table rendered `s.url` directly. If an
operator configured a source URL containing userinfo or token-like query
parameters, that metadata could be shown in the UI.

## 2. Scope

Changed files:

- `AdminPanel-Vue/src/views/PluginStore.vue`
- `docs/governance/H1_PLUGIN_STORE_SOURCE_URL_REDACTION_20260610.md`

No backend route, Plugin Store install behavior, Plugin loader, server startup,
release, deploy, npm publish, or real Plugin Store install/upload/uninstall
probe was changed or executed.

## 3. Display-Only Redaction Contract

`safeSourceUrlDisplay(raw)` is a frontend display helper only.

It reuses `sanitizeUserText()` so rendered source URLs redact:

- URL userinfo, such as `https://user:pass@example.com/x`;
- token-like query parameters, including `access_token`, `api_key`, `apikey`,
  `auth`, `authorization`, `bearer`, `cookie`, `key`, `password`, `passwd`,
  `secret`, `session`, and `token`;
- Bearer / Authorization-like text;
- absolute local paths.

The underlying `PluginSource.url` value is not mutated. Source add/delete and
install payload behavior remain unchanged.

## 4. Source Error Display

Source load errors are now sanitized defensively at render time, even though the
backend already routes Plugin Store errors through its scrubber.

This keeps UI display behavior aligned with the backend log/error redaction
contract.

## 5. Non-Goals

This patch does not:

- change source persistence;
- change backend URL validation or SSRF policy;
- change Plugin Store install/download/upload/uninstall behavior;
- change API typing;
- add source URL editing;
- run a real Plugin Store install/upload/uninstall probe;
- read or print real `.env`, `config.env`, or `Plugin/**/config.env` contents.

## 6. Closeout Checklist

- [x] Source URL table display uses `safeSourceUrlDisplay()`.
- [x] Source errors are rendered through `sanitizeUserText()`.
- [x] Backend source URL behavior is unchanged.
- [x] No real secrets were read or printed.
- [x] No real Plugin Store install/upload/uninstall was performed.
- [x] No release, deploy, or npm publish was performed.
