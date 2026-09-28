#!/usr/bin/env bash
set -euo pipefail

# Run inside the digest-pinned Ubuntu 22.04 image used by both CI and the
# isolated Linux development host. The source tree is mounted read-only.
source_root="${1:?source root required}"
output_root="${2:?output directory required}"
cache_root="${VEXUS_CACHE_ROOT:-/cache}"
compare_tracked="${VEXUS_COMPARE_TRACKED:-1}"

test -f "$source_root/rust-vexus-lite/Cargo.lock"
test -f "$source_root/rust-vexus-lite/vexus-lite.linux-x64-gnu.node"
mkdir -p "$cache_root/cargo" "$cache_root/rustup" "$cache_root/npm" "$output_root" /opt/vcp-node
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl xz-utils make pkg-config \
  gcc-12=12.3.0-1ubuntu1~22.04.3 g++-12=12.3.0-1ubuntu1~22.04.3 \
  binutils=2.38-4ubuntu2.12
test "$(gcc-12 -dumpfullversion)" = 12.3.0
test "$(getconf GNU_LIBC_VERSION)" = 'glibc 2.35'

export CARGO_HOME="$cache_root/cargo"
export RUSTUP_HOME="$cache_root/rustup"
export PATH="$CARGO_HOME/bin:$PATH"
if [[ ! -x "$CARGO_HOME/bin/rustup" ]]; then
  curl -fL --retry 3 --connect-timeout 15 https://sh.rustup.rs -o /tmp/vcp-rustup-init.sh
  sh /tmp/vcp-rustup-init.sh -y --profile minimal --default-toolchain 1.89.0 --no-modify-path
fi
rustup toolchain install 1.89.0 --profile minimal
export RUSTUP_TOOLCHAIN=1.89.0
export RUSTFLAGS='-C linker=gcc-12'
export CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER=gcc-12
test "$(rustc --version | awk '{print $2}')" = 1.89.0

node_archive="$cache_root/node-v22.23.1-linux-x64.tar.xz"
if [[ ! -s "$node_archive" ]]; then
  curl -fL --retry 3 --connect-timeout 15 \
    https://nodejs.org/dist/v22.23.1/node-v22.23.1-linux-x64.tar.xz \
    -o "$node_archive.partial"
  mv "$node_archive.partial" "$node_archive"
fi
echo '9749e988f437343b7fa832c69ded82a312e41a03116d766797ac14f6f9eee578  '"$node_archive" | sha256sum -c -
tar -xJf "$node_archive" -C /opt/vcp-node --strip-components=1
export PATH="/opt/vcp-node/bin:$PATH"
export npm_config_cache="$cache_root/npm"
test "$(node --version)" = v22.23.1
npm install --prefix /tmp/vcp-napi-cli --ignore-scripts --no-audit --no-fund @napi-rs/cli@2.18.4
test "$(node -p "require('/tmp/vcp-napi-cli/node_modules/@napi-rs/cli/package.json').version")" = 2.18.4

printf 'TOOLCHAIN rustc=%s gcc=%s glibc=%s node=%s napi=%s\n' \
  "$(rustc --version | awk '{print $2}')" "$(gcc-12 -dumpfullversion)" \
  "$(getconf GNU_LIBC_VERSION)" "$(node --version)" 2.18.4

build_once() {
  local iteration="$1"
  local build_root
  build_root="$(mktemp -d "/tmp/vexus-build-${iteration}.XXXXXXXX")"
  cp -a "$source_root/rust-vexus-lite" "$build_root/rust-vexus-lite"
  find "$build_root/rust-vexus-lite" -maxdepth 1 -type f -name '*.node' -delete
  if [[ -e "$build_root/rust-vexus-lite/target" ]]; then
    printf 'source contains target/; refusing contaminated build\n' >&2
    return 1
  fi
  (
    cd "$build_root/rust-vexus-lite"
    CC=gcc-12 CXX=g++-12 /tmp/vcp-napi-cli/node_modules/.bin/napi build \
      --platform --release --cargo-flags="--locked"
  )
  local binary="$build_root/rust-vexus-lite/vexus-lite.linux-x64-gnu.node"
  test -f "$binary"
  build_output="$binary"
}

build_once 1
build_1="$build_output"
build_once 2
build_2="$build_output"
sha_1="$(sha256sum "$build_1" | awk '{print $1}')"
sha_2="$(sha256sum "$build_2" | awk '{print $1}')"
tracked="$source_root/rust-vexus-lite/vexus-lite.linux-x64-gnu.node"
tracked_sha="$(sha256sum "$tracked" | awk '{print $1}')"
printf 'BUILD_1_SHA256=%s\nBUILD_2_SHA256=%s\nTRACKED_SHA256=%s\n' \
  "$sha_1" "$sha_2" "$tracked_sha"
if [[ "$sha_1" != "$sha_2" ]] || ! cmp -s "$build_1" "$build_2"; then
  printf 'REPRODUCIBLE=FAIL\n' >&2
  exit 1
fi
printf 'REPRODUCIBLE=PASS\n'

maximum_glibc="$(objdump -T "$build_1" | grep -oE 'GLIBC_[0-9]+\.[0-9]+' | sort -Vu | tail -n 1)"
printf 'MAX_GLIBC=%s\n' "$maximum_glibc"
if [[ "$(printf '%s\n' "$maximum_glibc" GLIBC_2.35 | sort -V | tail -n 1)" != GLIBC_2.35 ]]; then
  printf 'GLIBC_CEILING=FAIL\n' >&2
  exit 1
fi
printf 'GLIBC_CEILING=PASS\n'
install -m 644 "$build_1" "$output_root/vexus-lite.linux-x64-gnu.node"

if [[ "$compare_tracked" == 1 ]]; then
  if [[ "$sha_1" != "$tracked_sha" ]] || ! cmp -s "$build_1" "$tracked"; then
    printf 'SOURCE_ARTIFACT_MATCH=FAIL\n' >&2
    exit 1
  fi
  printf 'SOURCE_ARTIFACT_MATCH=PASS\n'
elif [[ "$compare_tracked" != 0 ]]; then
  printf 'invalid VEXUS_COMPARE_TRACKED value\n' >&2
  exit 1
fi
