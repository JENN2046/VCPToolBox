import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  MEMORY_READ_LIMITS,
  MEMORY_UPDATE_LIMITS,
  MemoryAuthorityError,
  assertMemoryOwnerAssertion,
  assertOwnedFolder,
  assertUtf8Limit,
  nativeMatchCandidates,
  preflightMemoryCreate,
  preflightMemoryRead,
  preflightMemoryUpdate,
  resolveMemoryAuthority,
  verifyMemoryPreflight,
} from "../src/memory-authority.mjs";

const OWNER = "NuobaoChatGPT";
const OWNED = ["NuobaoChatGPT", "NuobaoChatGPT的知识", "Nobao-Episodes"];
const TARGET = "This exact persistent memory sentence is deliberately longer than thirty characters.";

async function withDailyRoot(run) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "r0a-memory-authority-"));
  try {
    await fs.mkdir(path.join(root, "NuobaoChatGPT的知识"));
    await fs.mkdir(path.join(root, "Nobao-Episodes"));
    await fs.mkdir(path.join(root, "OtherAgent"));
    return await run(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

function expectCode(code) {
  return (error) => error instanceof MemoryAuthorityError && error.code === code;
}

test("freezes memory owner independently from chat persona", () => {
  const authority = resolveMemoryAuthority({
    memoryMaid: OWNER,
    memoryOwnedFolders: OWNED,
    dailyNoteRoot: "/absolute/dailynote",
  });
  assert.equal(authority.maid, OWNER);
  assert.deepEqual(authority.ownedFolders, OWNED);
  assert.equal(Object.hasOwn(authority, "systemPrompt"), false);
});

test("owned folders are exact and reject path or other-agent escape", () => {
  assert.equal(assertOwnedFolder("Nobao-Episodes", OWNED), "Nobao-Episodes");
  for (const folder of ["微明", "OtherAgent", "../foo", "../../dailynote", "/absolute/path"]) {
    assert.throws(
      () => assertOwnedFolder(folder, OWNED),
      expectCode("MEMORY_FOLDER_UNAUTHORIZED")
    );
  }
});

test("create owner assertion is optional but cannot override configured authority", () => {
  assert.equal(assertMemoryOwnerAssertion(undefined, OWNER), OWNER);
  assert.equal(assertMemoryOwnerAssertion(OWNER, OWNER), OWNER);
  assert.throws(
    () => assertMemoryOwnerAssertion("OtherAgent", OWNER),
    expectCode("MEMORY_OWNER_MISMATCH")
  );
});

test("create preflight admits only an exact existing owned folder", async () => {
  await withDailyRoot(async (root) => {
    const preflight = await preflightMemoryCreate({
      root,
      ownedFolders: OWNED,
      folder: "Nobao-Episodes",
    });
    assert.equal(preflight.folder, "Nobao-Episodes");
    assert.equal(path.dirname(preflight.folderReal), preflight.rootReal);

    await assert.rejects(
      preflightMemoryCreate({
        root,
        ownedFolders: OWNED,
        folder: "OtherAgent",
      }),
      expectCode("MEMORY_FOLDER_UNAUTHORIZED")
    );

    await assert.rejects(
      preflightMemoryCreate({
        root,
        ownedFolders: OWNED,
        folder: "NuobaoChatGPT",
      }),
      expectCode("MEMORY_FOLDER_NOT_FOUND")
    );
  });
});

test("create preflight rejects symbolic-link namespace escape", async () => {
  await withDailyRoot(async (root) => {
    const ownedPath = path.join(root, "Nobao-Episodes");
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "r0a-memory-outside-"));
    try {
      await fs.rm(ownedPath, { recursive: true, force: true });
      await fs.symlink(outside, ownedPath, "dir");
      await assert.rejects(
        preflightMemoryCreate({
          root,
          ownedFolders: OWNED,
          folder: "Nobao-Episodes",
        }),
        expectCode("MEMORY_SCAN_UNSAFE")
      );
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
});

test("create preflight fails closed when configured root is not a directory", async () => {
  await withDailyRoot(async (root) => {
    const notDirectory = path.join(root, "not-a-directory");
    await fs.writeFile(notDirectory, "x");
    await assert.rejects(
      preflightMemoryCreate({
        root: notDirectory,
        ownedFolders: OWNED,
        folder: "Nobao-Episodes",
      }),
      expectCode("MEMORY_ROOT_UNAVAILABLE")
    );
  });
});

test("exact memory read returns a stable owned document snapshot", async () => {
  await withDailyRoot(async (root) => {
    const content = `Header\n${TARGET}\nTag: read`;
    await fs.writeFile(path.join(root, "Nobao-Episodes", "memory.txt"), content);
    const snapshot = await preflightMemoryRead({
      root,
      ownedFolders: OWNED,
      folder: "Nobao-Episodes",
      fileName: "memory.txt",
    });
    assert.equal(snapshot.folder, "Nobao-Episodes");
    assert.equal(snapshot.name, "memory.txt");
    assert.equal(snapshot.content, content);
    assert.equal(snapshot.size, Buffer.byteLength(content, "utf8"));
    assert.match(snapshot.sha256, /^[a-f0-9]{64}$/u);
    assert.equal(Number.isFinite(snapshot.mtimeMs), true);
  });
});

test("exact memory read rejects unowned, unsafe, missing, and unsupported targets", async () => {
  await withDailyRoot(async (root) => {
    await fs.writeFile(path.join(root, "Nobao-Episodes", "memory.txt"), TARGET);

    await assert.rejects(
      preflightMemoryRead({
        root,
        ownedFolders: OWNED,
        folder: "OtherAgent",
        fileName: "memory.txt",
      }),
      expectCode("MEMORY_FOLDER_UNAUTHORIZED")
    );

    for (const fileName of ["../memory.txt", "/tmp/memory.txt", "nested/memory.txt", "memory.json"]) {
      await assert.rejects(
        preflightMemoryRead({
          root,
          ownedFolders: OWNED,
          folder: "Nobao-Episodes",
          fileName,
        }),
        expectCode("MEMORY_FILE_UNAUTHORIZED")
      );
    }

    await assert.rejects(
      preflightMemoryRead({
        root,
        ownedFolders: OWNED,
        folder: "Nobao-Episodes",
        fileName: "missing.txt",
      }),
      expectCode("MEMORY_FILE_NOT_FOUND")
    );
  });
});

test("exact memory read rejects symlinks and oversized documents", async () => {
  await withDailyRoot(async (root) => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "r0a-memory-read-outside-"));
    try {
      const outsideFile = path.join(outside, "outside.txt");
      await fs.writeFile(outsideFile, TARGET);
      await fs.symlink(outsideFile, path.join(root, "Nobao-Episodes", "link.txt"));
      await assert.rejects(
        preflightMemoryRead({
          root,
          ownedFolders: OWNED,
          folder: "Nobao-Episodes",
          fileName: "link.txt",
        }),
        expectCode("MEMORY_SCAN_UNSAFE")
      );
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }

    await fs.writeFile(
      path.join(root, "Nobao-Episodes", "large.txt"),
      Buffer.alloc(MEMORY_READ_LIMITS.maxFileBytes + 1, 0x61)
    );
    await assert.rejects(
      preflightMemoryRead({
        root,
        ownedFolders: OWNED,
        folder: "Nobao-Episodes",
        fileName: "large.txt",
      }),
      expectCode("MEMORY_READ_LIMIT")
    );
  });
});

test("preflight establishes one literal target in the requested owned document", async () => {
  await withDailyRoot(async (root) => {
    await fs.writeFile(path.join(root, "NuobaoChatGPT的知识", "memory.txt"), `Header\n${TARGET}\nTag: test`);
    const preflight = await preflightMemoryUpdate({
      root,
      ownedFolders: OWNED,
      folder: "NuobaoChatGPT的知识",
      target: TARGET,
    });
    assert.equal(preflight.folder, "NuobaoChatGPT的知识");
    assert.equal(preflight.fileName, "memory.txt");
    await verifyMemoryPreflight(preflight);
  });
});

test("zero and multiple matches fail closed", async () => {
  await withDailyRoot(async (root) => {
    await fs.writeFile(path.join(root, "NuobaoChatGPT的知识", "a.txt"), "no matching content");
    await assert.rejects(
      preflightMemoryUpdate({
        root,
        ownedFolders: OWNED,
        folder: "NuobaoChatGPT的知识",
        target: TARGET,
      }),
      expectCode("MEMORY_TARGET_NOT_FOUND")
    );

    await fs.writeFile(path.join(root, "NuobaoChatGPT的知识", "a.txt"), `${TARGET}\n${TARGET}`);
    await assert.rejects(
      preflightMemoryUpdate({
        root,
        ownedFolders: OWNED,
        folder: "NuobaoChatGPT的知识",
        target: TARGET,
      }),
      expectCode("MEMORY_TARGET_AMBIGUOUS")
    );
  });
});

test("native-eligible target outside the requested owned folder fails closed", async () => {
  await withDailyRoot(async (root) => {
    await fs.writeFile(path.join(root, "OtherAgent", "memory.txt"), TARGET);
    await assert.rejects(
      preflightMemoryUpdate({
        root,
        ownedFolders: OWNED,
        folder: "NuobaoChatGPT的知识",
        target: TARGET,
      }),
      expectCode("MEMORY_TARGET_OUTSIDE_AUTHORITY")
    );
  });
});

test("dehydrated-only matching is detected but never admitted for mutation", async () => {
  const spaced = TARGET.split("").join(" ");
  assert.equal(nativeMatchCandidates(spaced, TARGET).kind, "dehydrated");

  await withDailyRoot(async (root) => {
    await fs.writeFile(path.join(root, "NuobaoChatGPT的知识", "memory.txt"), spaced);
    await assert.rejects(
      preflightMemoryUpdate({
        root,
        ownedFolders: OWNED,
        folder: "NuobaoChatGPT的知识",
        target: TARGET,
      }),
      expectCode("MEMORY_TARGET_OUTSIDE_AUTHORITY")
    );
  });
});

test("snapshot verification detects a stale preflight", async () => {
  await withDailyRoot(async (root) => {
    const file = path.join(root, "NuobaoChatGPT的知识", "memory.txt");
    await fs.writeFile(file, TARGET);
    const preflight = await preflightMemoryUpdate({
      root,
      ownedFolders: OWNED,
      folder: "NuobaoChatGPT的知识",
      target: TARGET,
    });
    await fs.appendFile(file, "\nconcurrent change");
    await assert.rejects(
      verifyMemoryPreflight(preflight),
      expectCode("MEMORY_PRECONDITION_CHANGED")
    );
  });
});

test("UTF-8 input byte limits reject oversized values", () => {
  assert.doesNotThrow(() =>
    assertUtf8Limit("x".repeat(MEMORY_UPDATE_LIMITS.targetMaxBytes), MEMORY_UPDATE_LIMITS.targetMaxBytes, "target")
  );
  assert.throws(
    () =>
      assertUtf8Limit(
        "界".repeat(MEMORY_UPDATE_LIMITS.targetMaxBytes),
        MEMORY_UPDATE_LIMITS.targetMaxBytes,
        "target"
      ),
    expectCode("MEMORY_INPUT_TOO_LARGE")
  );
});
