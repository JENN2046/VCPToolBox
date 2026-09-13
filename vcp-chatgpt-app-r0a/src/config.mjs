import fs from "node:fs";
import path from "node:path";

function readSystemPrompt() {
  const file = String(process.env.VCP_SYSTEM_PROMPT_FILE || "").trim();
  const inline = String(process.env.VCP_SYSTEM_PROMPT || "").trim();

  if (file) {
    const resolved = path.resolve(process.cwd(), file);
    return fs.readFileSync(resolved, "utf8").trim();
  }
  return inline;
}

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function stringListEnv(name) {
  return Object.freeze(
    [...new Set(
      String(process.env[name] || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    )]
  );
}

export const config = Object.freeze({
  host: process.env.HOST || "127.0.0.1",
  port: numberEnv("PORT", 3010),
  vcpBaseUrl: process.env.VCP_BASE_URL || "http://127.0.0.1:6005",
  vcpApiKey: process.env.VCP_API_KEY || "",
  vcpTimeoutMs: numberEnv("VCP_TIMEOUT_MS", 120000),
  vcpChatPath: process.env.VCP_CHAT_PATH || "/v1/chat/completions",
  vcpDefaultModel: process.env.VCP_DEFAULT_MODEL || "",
  vcpSystemPrompt: readSystemPrompt(),
  memoryMaid: String(process.env.VCP_MEMORY_MAID || "").trim(),
  memoryOwnedFolders: stringListEnv("VCP_MEMORY_OWNED_FOLDERS"),
  dailyNoteRoot: String(process.env.VCP_DAILYNOTE_ROOT || "").trim(),
});
