import fs from "node:fs";
import path from "node:path";
import { VcpClient } from "../src/vcp-client.mjs";

function boolEnv(name) {
  return /^(1|true|yes|on)$/i.test(String(process.env[name] || ""));
}

function systemPrompt() {
  const file = String(process.env.VCP_SYSTEM_PROMPT_FILE || "").trim();
  if (file) return fs.readFileSync(path.resolve(process.cwd(), file), "utf8").trim();
  return String(process.env.VCP_SYSTEM_PROMPT || "").trim();
}

const vcp = new VcpClient({
  baseUrl: process.env.VCP_BASE_URL || "http://127.0.0.1:6005",
  apiKey: process.env.VCP_API_KEY || "",
  timeoutMs: Number(process.env.VCP_TIMEOUT_MS || 120000),
  chatPath: process.env.VCP_CHAT_PATH || "/v1/chat/completions",
  defaultModel: process.env.VCP_DEFAULT_MODEL || "",
  systemPrompt: systemPrompt(),
});

console.log("[A1] GET /v1/models");
const models = await vcp.listModels();
console.log(JSON.stringify(models, null, 2));

if (boolEnv("VCP_SMOKE_MEMORY")) {
  console.log("[A2] LightMemo via /v1/human/tool");
  const result = await vcp.memorySearch({
    query: process.env.VCP_SMOKE_QUERY || "VCP memory smoke test",
    folder: process.env.VCP_SMOKE_FOLDER || undefined,
    maid: process.env.VCP_SMOKE_MAID || undefined,
    k: Number(process.env.VCP_SMOKE_K || 3),
    searchAll:
      !process.env.VCP_SMOKE_FOLDER && !process.env.VCP_SMOKE_MAID,
  });
  console.log(JSON.stringify(result, null, 2));
}

if (boolEnv("VCP_SMOKE_CHAT")) {
  console.log("[A3] Full VCP /v1/chat/completions pipeline");
  const result = await vcp.chat({
    prompt:
      "R0-A connectivity test. Reply briefly and do not create or modify any persistent data.",
  });
  console.log(JSON.stringify(result, null, 2));
}

console.log("PASS_R0A_DIRECT_VCP_SMOKE");
