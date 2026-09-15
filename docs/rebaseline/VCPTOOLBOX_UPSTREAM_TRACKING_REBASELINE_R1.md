# VCPTOOLBOX_UPSTREAM_TRACKING_REBASELINE_R1

```text
STATUS: ACTIVE
PHASE_0: CLOSED
SIX_PACKAGE_MATRIX: FROZEN
CURRENT_MILESTONE: M1
M1_NAME: CLEAN_UPSTREAM_BASELINE_AND_ACCEPTANCE_HARNESS
```

## Authority and baseline

```text
UPSTREAM:
lioensky/VCPToolBox::main
9deadda698eb87b4ee2aef5c27ea7c01e8970a02
TREE: 83d9d49f626ea7f782203ba7ad24197dfbc909fc

M1 CLEAN LANE:
JENN2046/VCPToolBox::integration/vcptoolbox-upstream-rebaseline-r1-m1
BASE: exact upstream commit above

LEGACY MIGRATION SOURCE / REFERENCE ONLY:
JENN2046/VCPToolBox::nuobao-vcptoolbox
e3ca2caebd32d7e1a05c61e01fd25275777f6a89

HISTORICAL CLEAN-LANE REFERENCE ONLY:
JENN2046/VCPToolBox::integration/clean-upstream-main
62e7e2693bac3f2c556f8f2e9d9f1f08bcced5e2

DURABLE PREREQUISITE EVIDENCE:
JENN2046/agents-os-vcptoolbox-authority
agent/vcptoolbox-selected-source-baseline
NOT A DEVELOPMENT FORK
```

The new tracking lane is rebuilt from the current exact author commit. The thick fork is not rebased, merged wholesale, or replayed commit-by-commit.

## Frozen six-package migration matrix

The canonical machine-readable matrix is:

`docs/rebaseline/vcptoolbox-upstream-tracking-rebaseline-r1.matrix.json`

Exactly six migration packages are admitted:

1. **P1 — Native manifest producer / FMS native-v1 surface**  
   Preserve the current consumed native-v1 discovery contract. Do not migrate unrelated historical fork code.

2. **P2 — External plugin composition and admission**  
   Preserve the current explicit external-root / directory / allowlist composition seam, path containment, exact admission identity, registration gating, and external-runtime environment sandbox. External plugins remain default-denied unless explicitly admitted.

3. **P3 — AGENTS OS Resident host contract**  
   Preserve only the VCPToolBox host seams required by the external Resident authority. Resident source stays in Agents-OS. Missing/unadmitted Resident remains fail-closed. No installation, allowlisting, provider activation, or production identity claim is authorized by source migration.

4. **P4 — Trusted Human authorization kernel**  
   Preserve `Trusted Client + Explicit Human Intent + Exact Pending Authority Target`, including verified admission and exact execution/receipt binding. Do not treat generic bearer auth, IP, deviceName, model identity, or caller claims as Human Authorization. UI is not a core prerequisite.

5. **P5 — Vexus Linux native ABI compatibility**  
   Preserve the ABI/reproducibility invariant, not the historical binary. Rebuild from the exact accepted current upstream source and validate the Linux GNU compatibility ceiling/runtime contract.

6. **P6 — VCP-APP LightMemo / Cold TDB compatibility seam**  
   Preserve consumed Cold routing, structured/preview compatibility, L03 LightMemo candidate dedup, and trace seam where consumed. Prefer current upstream TDB internals. `modules/tdbRecovery` is not admitted by default and requires new consumer evidence before migration.

## Frozen exclusions

M1 and subsequent migration slices do **not** reopen full-repository inventory. The following are outside the frozen migration set unless a material authority conflict is proven:

```text
wholesale thick-fork history
historical implementation for its own sake
AdminPanel UI as authorization authority
full Runtime V2 framework by default
Resident source vendoring
modules/tdbRecovery by default
old Vexus binary carry-forward
runtime activation / service restart / deployment
DB or memory-state migration
automatic external-plugin admission
```

## M1 contract

M1 is intentionally non-product:

```text
M1 =
exact current upstream ancestry
+
frozen six-package matrix
+
package-level acceptance harness
```

M1 MUST NOT modify product/runtime source.

### M1 exit gate

M1 passes only when all are true:

```text
1. Clean lane descends directly from upstream 9deadda698eb...
2. The matrix is FROZEN and contains exactly P1..P6.
3. The acceptance harness validates baseline identity, package identity and exclusions.
4. The M1 diff contains only rebaseline governance / acceptance artifacts.
5. No runtime activation, deployment, service restart or state migration occurred.
```

After M1, package migration proceeds as bounded slices against the clean lane. A package may be retired if current upstream already satisfies its consumed semantics; a historical implementation is never protected merely because it exists.
