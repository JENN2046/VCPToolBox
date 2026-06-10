# H1 Plugin Store SSRF Policy Tightening

Date: 2026-06-10

Status: hardening implementation

## 1. Purpose

This H1 hardening patch tightens the Plugin Store network fetch guard before
real external install usage expands further.

The existing guard already blocked localhost, private IPv4 basics, and DNS
answers that resolved to private addresses. This patch closes the remaining
policy gaps around DNS failure, redirects, and non-public IP ranges.

## 2. Scope

Changed files:

- `routes/admin/pluginStore.js`
- `tests/plugin-store-ssrf-policy.test.js`
- `docs/governance/H1_PLUGIN_STORE_SSRF_POLICY_TIGHTENING_20260610.md`

No AdminPanel UI, Plugin loader, server startup, release, deploy, npm publish,
real Plugin Store install/upload/uninstall, or real network probe was performed.

## 3. Policy Contract

Plugin Store fetches now follow these rules:

- only `http:` and `https:` URLs are accepted;
- localhost hostnames remain blocked;
- DNS failure fails closed;
- DNS answers that resolve to non-public addresses are blocked;
- redirects are handled manually;
- every redirect hop is revalidated before the next fetch;
- private redirect targets are rejected before the redirected request is made;
- redirect chains have a bounded limit.

## 4. IP Range Completion

The non-public address classifier now blocks:

- loopback, link-local, private, multicast, reserved, documentation, benchmark,
  and carrier-grade NAT IPv4 ranges;
- IPv4-mapped private IPv6;
- IPv6 unspecified, loopback, ULA, link-local, deprecated site-local,
  multicast, documentation, Teredo, and 6to4 ranges.

The intent is conservative SSRF protection, not a public IP allowlist service.

## 5. Low-Disclosure Errors

SSRF policy failures use code-bearing errors such as:

- `plugin_store_url_dns_failed`
- `plugin_store_url_private_dns_blocked`
- `plugin_store_url_private_host_blocked`
- `plugin_store_url_redirect_limit`

Messages avoid returning full local/internal target URLs. Existing Plugin Store
log/error scrubbers still handle thrown error messages before Admin response or
SSE/status storage.

## 6. Tests

Added focused tests verify:

- non-public IPv4 and IPv6 ranges are blocked;
- public representative IPv4/IPv6 values remain allowed;
- DNS lookup failure fails closed;
- DNS answers resolving to private addresses are rejected;
- private redirect targets are rejected before the redirected fetch;
- public redirects are followed after revalidation;
- redirect limit failures do not leak the target URL.

Tests use mocked DNS and mocked fetch. No real network request is made.

## 7. Non-Goals

This patch does not:

- change Plugin Store install root behavior;
- change archive extraction policy;
- change AdminPanel UI;
- change source persistence;
- introduce a runtime URL allowlist UI;
- run real Plugin Store install/upload/uninstall;
- read or print real `.env`, `config.env`, or `Plugin/**/config.env` contents.

## 8. Closeout Checklist

- [x] DNS failure now fails closed.
- [x] Redirect hops are revalidated.
- [x] Private redirect target is rejected before redirected fetch.
- [x] Non-public IP classification is broadened.
- [x] Tests use mocked DNS/fetch only.
- [x] No real secrets are read or printed.
- [x] No real network probe is performed.
- [x] No release, deploy, or npm publish is performed.
