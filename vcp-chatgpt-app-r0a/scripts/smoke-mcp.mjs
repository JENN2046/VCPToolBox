import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

function boolEnv(name) {
  return /^(1|true|yes|on)$/i.test(String(process.env[name] || ""));
}

const endpoint = new URL(
  process.env.MCP_URL || `http://127.0.0.1:${process.env.PORT || 3010}/mcp`
);

const client = new Client({
  name: "vcp-r0a-smoke-client",
  version: "0.3.0",
});

try {
  console.log(`[M1] initialize ${endpoint}`);
  await client.connect(new StreamableHTTPClientTransport(endpoint));

  console.log("[M2] tools/list");
  const tools = await client.listTools();
  console.log(tools.tools.map((t) => t.name).join("\n"));

  console.log("[M3] tools/call vcp_status");
  const status = await client.callTool({
    name: "vcp_status",
    arguments: {},
  });
  console.log(JSON.stringify(status, null, 2));
  if (status.isError) throw new Error("vcp_status returned isError");

  if (boolEnv("VCP_SMOKE_MEMORY")) {
    console.log("[M4] tools/call vcp_memory_search");
    const memory = await client.callTool({
      name: "vcp_memory_search",
      arguments: {
        query: process.env.VCP_SMOKE_QUERY || "VCP memory smoke test",
        folder: process.env.VCP_SMOKE_FOLDER || undefined,
        maid: process.env.VCP_SMOKE_MAID || undefined,
        k: Number(process.env.VCP_SMOKE_K || 3),
        search_all_knowledge_bases:
          !process.env.VCP_SMOKE_FOLDER && !process.env.VCP_SMOKE_MAID,
      },
    });
    console.log(JSON.stringify(memory, null, 2));
    if (memory.isError) throw new Error("vcp_memory_search returned isError");
  }

  if (boolEnv("VCP_SMOKE_CHAT")) {
    console.log("[M5] tools/call vcp_chat");
    const chat = await client.callTool({
      name: "vcp_chat",
      arguments: {
        prompt:
          "R0-A MCP-to-VCP test. Reply briefly and do not create or modify persistent data.",
      },
    });
    console.log(JSON.stringify(chat, null, 2));
    if (chat.isError) throw new Error("vcp_chat returned isError");
  }

  console.log("PASS_R0A_MCP_TO_VCP_SMOKE");
} finally {
  await client.close().catch(() => {});
}
