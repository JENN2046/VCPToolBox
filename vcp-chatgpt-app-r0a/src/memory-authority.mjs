import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const IGNORED_FOLDERS = new Set(["MusicDiary"]);

export const MEMORY_UPDATE_LIMITS = Object.freeze({
  targetMinChars: 30,
  targetMaxChars: 64 * 1024,
  targetMaxBytes: 64 * 1024,
  replaceMinChars: 1,
  replaceMaxChars: 512 * 1024,
  replaceMaxBytes: 512 * 1024,
  maxScanFiles: 10_000,
  maxScanFileBytes: 8 * 1024 * 1024,
  maxScanTotalBytes: 256 * 1024 * 1024,
});

export const MEMORY_READ_LIMITS = Object.freeze({
  fileNameMaxChars: 255,
  maxFileBytes: 512 * 1024,
});

export class MemoryAuthorityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MemoryAuthorityError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new MemoryAuthorityError(code, message);
}

function isSafeFolderName(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    value !== "." &&
    value !== ".." &&
    !path.isAbsolute(value) &&
    path.basename(value) === value &&
    !/[\\/:*?"<>|\x00-\x1f\x7f]/u.test(value) &&
    !/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(value)
  );
}

export function resolveMemoryAuthority(config) {
  const maid = String(config?.memoryMaid || "").trim();
  const folders = Array.isArray(config?.memoryOwnedFolders)
    ? [...new Set(config.memoryOwnedFolders)]
    : [];
  const root = String(config?.dailyNoteRoot || "").trim();

  if (!maid) {
    fail("MEMORY_AUTHORITY_NOT_CONFIGURED", "Persistent-memory owner is not configured.");
  }
  if (folders.length === 0 || folders.some((folder) => !isSafeFolderName(folder))) {
    fail(
      "MEMORY_FOLDER_POLICY_INVALID",
      "Persistent-memory owned-folder policy is missing or invalid."
    );
  }
  if (!root || !path.isAbsolute(root)) {
    fail(
      "MEMORY_ROOT_NOT_CONFIGURED",
      "Persistent-memory root must be an absolute server-side path."
    );
  }

  return Object.freeze({
    maid,
    ownedFolders: Object.freeze(folders),
    root,
  });
}

export function assertOwnedFolder(folder, ownedFolders) {
  if (!isSafeFolderName(folder) || !ownedFolders.includes(folder)) {
    fail("MEMORY_FOLDER_UNAUTHORIZED", "The requested folder is not an owned memory namespace.");
  }
  return folder;
}

export function assertMemoryOwnerAssertion(requestedMaid, configuredMaid) {
  if (requestedMaid === undefined) return configuredMaid;
  if (requestedMaid !== configuredMaid) {
    fail(
      "MEMORY_OWNER_MISMATCH",
      "The requested memory owner does not match the server-configured persistent-memory owner."
    );
  }
  return configuredMaid;
}

export async function preflightMemoryCreate({ root, ownedFolders, folder }) {
  assertOwnedFolder(folder, ownedFolders);

  let rootReal;
  try {
    rootReal = await fs.realpath(root);
    const rootStats = await fs.stat(rootReal);
    if (!rootStats.isDirectory()) {
      fail("MEMORY_ROOT_UNAVAILABLE", "The configured DailyNote root is unavailable.");
    }
  } catch (error) {
    if (error instanceof MemoryAuthorityError) throw error;
    fail("MEMORY_ROOT_UNAVAILABLE", "The configured DailyNote root is unavailable.");
  }

  const folderPath = path.join(rootReal, folder);
  let folderLstat;
  try {
    folderLstat = await fs.lstat(folderPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail("MEMORY_FOLDER_NOT_FOUND", "The owned memory folder does not exist exactly.");
    }
    fail("MEMORY_SCAN_UNSAFE", "The owned memory folder cannot be safely inspected.");
  }

  if (folderLstat.isSymbolicLink()) {
    fail("MEMORY_SCAN_UNSAFE", "A symbolic-link memory folder prevents safe create admission.");
  }
  if (!folderLstat.isDirectory()) {
    fail("MEMORY_FOLDER_NOT_FOUND", "The owned memory folder does not exist exactly.");
  }

  let folderReal;
  try {
    folderReal = await fs.realpath(folderPath);
  } catch {
    fail("MEMORY_SCAN_UNSAFE", "The owned memory folder cannot be safely resolved.");
  }

  if (path.dirname(folderReal) !== rootReal || path.basename(folderReal) !== folder) {
    fail("MEMORY_SCAN_UNSAFE", "The owned memory folder escapes the configured root.");
  }

  return Object.freeze({
    rootReal,
    folder,
    folderReal,
  });
}

function isSafeMemoryFileName(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MEMORY_READ_LIMITS.fileNameMaxChars &&
    value === value.trim() &&
    value !== "." &&
    value !== ".." &&
    !path.isAbsolute(value) &&
    !path.win32.isAbsolute(value) &&
    path.basename(value) === value &&
    path.win32.basename(value) === value &&
    /\.(?:txt|md)$/iu.test(value) &&
    !/[\\/:*?"<>|\x00-\x1f\x7f]/u.test(value) &&
    !/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(value)
  );
}

export async function preflightMemoryRead({ root, ownedFolders, folder, fileName }) {
  const namespace = await preflightMemoryCreate({ root, ownedFolders, folder });
  if (!isSafeMemoryFileName(fileName)) {
    fail("MEMORY_FILE_UNAUTHORIZED", "The requested memory file name is not safe or supported.");
  }

  const filePath = path.join(namespace.folderReal, fileName);
  let fileLstat;
  try {
    fileLstat = await fs.lstat(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail("MEMORY_FILE_NOT_FOUND", "The requested memory document does not exist exactly.");
    }
    fail("MEMORY_SCAN_UNSAFE", "The requested memory document cannot be safely inspected.");
  }

  if (fileLstat.isSymbolicLink()) {
    fail("MEMORY_SCAN_UNSAFE", "A symbolic-link memory file prevents safe read admission.");
  }
  if (!fileLstat.isFile()) {
    fail("MEMORY_FILE_NOT_FOUND", "The requested memory document does not exist exactly.");
  }
  if (fileLstat.size > MEMORY_READ_LIMITS.maxFileBytes) {
    fail("MEMORY_READ_LIMIT", "The requested memory document exceeds the exact-read size limit.");
  }

  let fileReal;
  try {
    fileReal = await fs.realpath(filePath);
  } catch {
    fail("MEMORY_SCAN_UNSAFE", "The requested memory document cannot be safely resolved.");
  }
  if (
    path.dirname(fileReal) !== namespace.folderReal ||
    path.basename(fileReal) !== fileName
  ) {
    fail("MEMORY_SCAN_UNSAFE", "The requested memory document escapes the owned namespace.");
  }

  return readStableFile({
    folder: namespace.folder,
    name: fileName,
    filePath: fileReal,
  });
}

function normalizeLooseMatchChar(char) {
  switch (char) {
    case "\u201c":
    case "\u201d":
    case "\u201e":
    case "\u201f":
    case "\uff02":
      return '"';
    case "\u2018":
    case "\u2019":
    case "\u201a":
    case "\u201b":
    case "\uff07":
      return "'";
    case "\uff08":
      return "(";
    case "\uff09":
      return ")";
    case "\uff0c":
    case "\u3001":
      return ",";
    case "\uff1a":
      return ":";
    case "\uff1b":
      return ";";
    case "\uff01":
      return "!";
    case "\uff1f":
      return "?";
    case "\u3002":
    case "\uff0e":
      return ".";
    case "\u2026":
      return "...";
    case "\u2014":
    case "\u2013":
      return "-";
    default:
      return char.toLowerCase();
  }
}

function shouldRemoveForLooseMatch(char) {
  return /\s/u.test(char) || char === "\\";
}

export function dehydrateForNativeMatch(text) {
  let normalized = "";
  for (const char of text) {
    if (!shouldRemoveForLooseMatch(char)) {
      normalized += normalizeLooseMatchChar(char);
    }
  }
  return normalized;
}

function occurrenceIndexes(content, target) {
  if (!target) return [];
  const indexes = [];
  let start = 0;
  while (start <= content.length - target.length) {
    const index = content.indexOf(target, start);
    if (index === -1) break;
    indexes.push(index);
    start = index + 1;
  }
  return indexes;
}

export function nativeMatchCandidates(content, target) {
  const exact = occurrenceIndexes(content, target);
  if (exact.length > 0) {
    return { kind: "exact", indexes: exact };
  }

  const looseTarget = dehydrateForNativeMatch(target);
  if (!looseTarget) {
    return { kind: "none", indexes: [] };
  }
  const looseContent = dehydrateForNativeMatch(content);
  const loose = occurrenceIndexes(looseContent, looseTarget);
  return loose.length > 0
    ? { kind: "dehydrated", indexes: loose }
    : { kind: "none", indexes: [] };
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function collectTextFileInventory(rootReal) {
  const rootEntries = await fs.readdir(rootReal, { withFileTypes: true });
  const directories = rootEntries
    .filter((entry) => entry.isDirectory() && !IGNORED_FOLDERS.has(entry.name))
    .map((entry) => entry.name)
    .sort();

  const files = [];
  for (const folder of directories) {
    const folderPath = path.join(rootReal, folder);
    const folderLstat = await fs.lstat(folderPath);
    if (folderLstat.isSymbolicLink()) {
      fail("MEMORY_SCAN_UNSAFE", "A symbolic-link memory folder prevents safe preflight.");
    }
    const folderReal = await fs.realpath(folderPath);
    if (path.dirname(folderReal) !== rootReal || path.basename(folderReal) !== folder) {
      fail("MEMORY_SCAN_UNSAFE", "A memory folder escapes the configured root.");
    }

    const names = (await fs.readdir(folderReal))
      .filter((name) => /\.(?:txt|md)$/iu.test(name))
      .sort();
    for (const name of names) {
      const filePath = path.join(folderReal, name);
      const fileLstat = await fs.lstat(filePath);
      if (fileLstat.isSymbolicLink()) {
        fail("MEMORY_SCAN_UNSAFE", "A symbolic-link memory file prevents safe preflight.");
      }
      if (!fileLstat.isFile()) continue;
      files.push({ folder, name, filePath });
    }
  }

  if (files.length > MEMORY_UPDATE_LIMITS.maxScanFiles) {
    fail("MEMORY_SCAN_LIMIT", "The DailyNote inventory exceeds the safe preflight file limit.");
  }
  return { directories, files };
}

async function readStableFile(file) {
  const before = await fs.stat(file.filePath);
  if (before.size > MEMORY_UPDATE_LIMITS.maxScanFileBytes) {
    fail("MEMORY_SCAN_LIMIT", "A DailyNote file exceeds the safe preflight size limit.");
  }
  const content = await fs.readFile(file.filePath, "utf8");
  const after = await fs.stat(file.filePath);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
    fail("MEMORY_PRECONDITION_CHANGED", "DailyNote content changed during preflight.");
  }
  return {
    ...file,
    size: after.size,
    mtimeMs: after.mtimeMs,
    sha256: sha256(content),
    content,
  };
}

export async function preflightMemoryUpdate({ root, ownedFolders, folder, target }) {
  assertOwnedFolder(folder, ownedFolders);

  let rootReal;
  try {
    rootReal = await fs.realpath(root);
    const rootStats = await fs.stat(rootReal);
    if (!rootStats.isDirectory()) {
      fail("MEMORY_ROOT_UNAVAILABLE", "The configured DailyNote root is unavailable.");
    }
  } catch (error) {
    if (error instanceof MemoryAuthorityError) throw error;
    fail("MEMORY_ROOT_UNAVAILABLE", "The configured DailyNote root is unavailable.");
  }

  const inventory = await collectTextFileInventory(rootReal);
  if (!inventory.directories.includes(folder)) {
    fail("MEMORY_FOLDER_NOT_FOUND", "The owned memory folder does not exist exactly.");
  }

  const snapshots = [];
  const candidates = [];
  let totalBytes = 0;
  for (const file of inventory.files) {
    const snapshot = await readStableFile(file);
    totalBytes += snapshot.size;
    if (totalBytes > MEMORY_UPDATE_LIMITS.maxScanTotalBytes) {
      fail("MEMORY_SCAN_LIMIT", "The DailyNote inventory exceeds the safe preflight byte limit.");
    }

    const match = nativeMatchCandidates(snapshot.content, target);
    snapshots.push({
      folder: snapshot.folder,
      name: snapshot.name,
      filePath: snapshot.filePath,
      size: snapshot.size,
      mtimeMs: snapshot.mtimeMs,
      sha256: snapshot.sha256,
    });
    for (const index of match.indexes) {
      candidates.push({
        folder: snapshot.folder,
        name: snapshot.name,
        filePath: snapshot.filePath,
        kind: match.kind,
        index,
      });
    }
  }

  if (candidates.length === 0) {
    fail("MEMORY_TARGET_NOT_FOUND", "Target text was not found exactly once in owned memory.");
  }
  if (candidates.length !== 1) {
    fail("MEMORY_TARGET_AMBIGUOUS", "Target text is ambiguous; no memory was updated.");
  }

  const candidate = candidates[0];
  if (candidate.folder !== folder || candidate.kind !== "exact") {
    fail(
      "MEMORY_TARGET_OUTSIDE_AUTHORITY",
      "The only native-eligible target is not one literal match in the requested owned folder."
    );
  }

  return Object.freeze({
    rootReal,
    folder,
    fileName: candidate.name,
    filePath: candidate.filePath,
    snapshots: Object.freeze(snapshots),
    inventoryKey: JSON.stringify(
      inventory.files.map((file) => [file.folder, file.name])
    ),
  });
}

export async function verifyMemoryPreflight(preflight) {
  const inventory = await collectTextFileInventory(preflight.rootReal);
  const inventoryKey = JSON.stringify(
    inventory.files.map((file) => [file.folder, file.name])
  );
  if (inventoryKey !== preflight.inventoryKey) {
    fail("MEMORY_PRECONDITION_CHANGED", "DailyNote inventory changed after preflight.");
  }

  for (const snapshot of preflight.snapshots) {
    const current = await readStableFile(snapshot);
    if (
      current.size !== snapshot.size ||
      current.mtimeMs !== snapshot.mtimeMs ||
      current.sha256 !== snapshot.sha256
    ) {
      fail("MEMORY_PRECONDITION_CHANGED", "DailyNote content changed after preflight.");
    }
  }
}

export function assertUtf8Limit(value, maxBytes, label) {
  if (Buffer.byteLength(value, "utf8") > maxBytes) {
    fail("MEMORY_INPUT_TOO_LARGE", `${label} exceeds the safe UTF-8 byte limit.`);
  }
}
