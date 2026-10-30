#!/usr/bin/env bash
set -euo pipefail

# One immutable build environment for the Linux development host and GitHub CI.
image='docker.io/library/ubuntu@sha256:b8b6ee6aa931ecd9d0d952abc34dc0e5f7c6a30c6bb71b079fe399fde0329c02'
source_root="$(realpath "${1:?source directory required}")"
output_root="$(realpath -m "${2:?output directory required}")"
cache_root="$(realpath -m "${3:?cache directory required}")"
test -f "$source_root/rust-vexus-lite/Cargo.lock"
mkdir -p "$output_root" "$cache_root"

docker run --rm --platform linux/amd64 --pull=missing --network host \
  --mount "type=bind,src=$source_root,dst=/src,readonly" \
  --mount "type=bind,src=$output_root,dst=/out" \
  --mount "type=bind,src=$cache_root,dst=/cache" \
  --env "VEXUS_COMPARE_TRACKED=${VEXUS_COMPARE_TRACKED:-1}" \
  "$image" \
  bash /src/scripts/rebuild-vexus-linux-native-abi.sh /src /out
