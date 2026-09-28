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

The `Vexus Linux Native ABI` workflow runs the same wrapper on every relevant
pull request and additionally checks the Node/runtime contract. It does not
publish an image, deploy a service, or access production configuration or data.
