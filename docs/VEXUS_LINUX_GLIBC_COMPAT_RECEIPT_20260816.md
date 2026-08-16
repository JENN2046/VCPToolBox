# Vexus Linux x64 GNU compatibility receipt — 2026-08-16

## Scope

This receipt covers only the Linux x64 GNU N-API artifact built from
`JENN2046/VCPToolBox` branch `integration/clean-upstream-main` at commit
`2f5a64d87ba028fb01a0548c859c632be6416bd7`. It does not import the separate
dirty VCPToolBox worktree, synchronize later upstream commits, activate a
runtime, or access a production diary or vector store.

## Source and builder authority

- Source commit: `2f5a64d87ba028fb01a0548c859c632be6416bd7`
- Cargo.lock SHA-256: `cca8c8a77ecec47564f357fe01e4098b7ca445453029a09a61eb3d30530a3554`
- Builder: Ubuntu 22.04.5 LTS, glibc 2.35
- Builder image: `ubuntu@sha256:3b06811b2afd352be909dd088a004166d665dc76d38b13eada33522a9d915c6f`
- Rust: `rustc 1.89.0 (29483883e 2025-08-04)`
- Cargo: `cargo 1.89.0 (c24e10642 2025-06-23)`
- C/C++: GCC/G++ 12.3.0
- Node: 22.23.1
- npm: 10.9.8
- `@napi-rs/cli`: 2.18.4
- Node archive SHA-256: `9749e988f437343b7fa832c69ded82a312e41a03116d766797ac14f6f9eee578`

Build command inside the pinned image:

```text
CC=gcc-12 CXX=g++-12 npx --no-install napi build --platform --release --cargo-flags="--locked"
```

The source directory was mounted read-only and copied into each ephemeral
builder. Only the resulting `vexus-lite.linux-x64-gnu.node` was exported.

## Artifact evidence

| Property | Replaced artifact | Compatibility rebuild |
|---|---|---|
| SHA-256 | `a5bb53abb1de27a601c6613937a83ae9bdffbe3afe3d13e4c3a0d8e8a3affe51` | `8d969b407d3458d835656286570cebba9cc0981b3e505a25701e7b48f15a5c54` |
| ELF Build ID | `64e24e0af85f98bc5ddeb0aea891a751fc152765` | `105a41b7926646d00d3e00b1229df48292552862` |
| Maximum required GLIBC | 2.43 | 2.35 |
| Native Node 22.23.1 load | FAIL on Ubuntu 24.04 / glibc 2.39 | PASS |

Two fresh builders produced byte-identical compatibility artifacts with the
same SHA-256, ELF Build ID, size, exported API, and GLIBC requirement.

## Functional contract

The rebuilt artifact passed the following checks using temporary scratch state:

- direct `require("./rust-vexus-lite")`;
- top-level and `VexusIndex` method surface required by the current JS source;
- `VexusIndex` construction, add, search, save, load, and clean exit;
- `KnowledgeBaseManager.js` dependency load without initialization;
- maximum required GLIBC no newer than 2.35.

The regression gate is `scripts/check-vexus-linux-native-abi.js`; the dedicated
pull-request workflow runs it on Ubuntu 22.04 with Node 22.23.1.
