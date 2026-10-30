# Linux Vexus native ABI build

The Linux x64 GNU binary is rebuilt by the same script on the isolated Linux
development host and in GitHub Actions. The wrapper pins the official Ubuntu
22.04 image by digest, installs exact GCC 12, Rust 1.89.0, Node 22.23.1 and
`@napi-rs/cli` 2.18.4 versions, and verifies the Node archive checksum.

From an isolated Linux checkout or source copy (not a running installation):

```bash
mkdir -p /tmp/vexus-abi-output /tmp/vexus-abi-cache
bash scripts/run-vexus-linux-native-abi-container.sh \
  "$PWD" /tmp/vexus-abi-output /tmp/vexus-abi-cache
```

Use `sudo bash` for the wrapper if the development account needs elevated
Docker access; do not run the command in a production checkout.

The script creates two independent release builds from `Cargo.lock`, compares
their bytes and SHA-256 hashes, enforces the GLIBC 2.35 ceiling, and compares
the result to the tracked `rust-vexus-lite/vexus-lite.linux-x64-gnu.node`.
The source mount is read-only. During initial artifact regeneration only,
`VEXUS_COMPARE_TRACKED=0` skips the tracked-artifact comparison while keeping
both independent builds and the GLIBC gate; copy the resulting binary into a
reviewed candidate, then rerun without that override.

Each independent build remaps its temporary root to `/vcp-native-build` so
local Rust dependency panic locations do not embed different build paths.
APT downloads use the task cache alongside Cargo, Rustup and npm; package
verification and pinned compiler checks still run, and build targets remain
independent.

The `Vexus Linux Native ABI` workflow runs the same wrapper on every relevant
pull request and additionally checks the Node/runtime contract. It does not
publish an image, deploy a service, or access production configuration or data.


## Upstream Integration R1-B candidate (2026-10-29)

The Linux CI recipe, image digest, Rust 1.89.0 / GCC 12.3.0 / Node 22.23.1 / napi 2.18.4 versions, independent two-build comparison, and GLIBC 2.35 ceiling remain unchanged. The current Linux payload is rebuilt from the merged source; its exact source and binary inventory is recorded separately in `docs/native-delivery-upstream-r1-linux.json`. Historical receipts are preserved.

```sh
node scripts/check-native-delivery.cjs x86_64-unknown-linux-gnu vexus daily --receipt docs/native-delivery-upstream-r1-linux.json
node scripts/check-vexus-linux-native-abi.js
```

The Linux workflow now uses the candidate receipt after an actual isolated pinned-image double build. This is a local validation result; no remote CI was triggered. Windows merged-source output remains unavailable; its upstream payload is quarantined and its historical provenance gate is not declared passed. Other platforms require their own build and acceptance evidence. Full commands, hashes, earlier attempts and platform limits are recorded in `review/upstream-r1/native-report.md`.
