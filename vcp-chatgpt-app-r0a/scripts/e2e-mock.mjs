import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const cwd = process.cwd();
const mockPort = 16005;
const mcpPort = 13010;
const memoryMaid = "NuobaoChatGPT";
const ownedFolder = "NuobaoChatGPT的知识";
const updateTarget =
  "This mock memory target is intentionally unique and longer than thirty characters.";
const updateReplace = "This is the replacement memory text.";
const initialMemoryBody = `Header\n${updateTarget}\nTag: mock`;
const dailyRoot = await fs.mkdtemp(path.join(os.tmpdir(), "r0a-e2e-dailynote-"));
const ownedFolderPath = path.join(dailyRoot, ownedFolder);
const targetFile = path.join(ownedFolderPath, "memory.txt");
await fs.mkdir(ownedFolderPath, { recursive: true });
await fs.mkdir(path.join(dailyRoot, "OtherAgent"), { recursive: true });
await fs.writeFile(targetFile, initialMemoryBody);

function spawnNode(args, env) {
  return spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitFor(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function textFromResult(result) {
  return (result.content || [])
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

const mock = spawnNode(["scripts/mock-vcp.mjs"], {
  MOCK_VCP_PORT: String(mockPort),
  MOCK_VCP_KEY: "test-key",
  MOCK_DAILYNOTE_TARGET_FILE: targetFile,
  MOCK_DAILYNOTE_TARGET_NAME: path.basename(targetFile),
  MOCK_DAILYNOTE_WRAPPED_TARGET_FILE: `${path.basename(dailyRoot)}/${ownedFolder}/${path.basename(targetFile)}`,
});

const mcp = spawnNode(["src/server.mjs"], {
  HOST: "127.0.0.1",
  PORT: String(mcpPort),
  VCP_BASE_URL: `http://127.0.0.1:${mockPort}`,
  VCP_API_KEY: "test-key",
  VCP_DEFAULT_MODEL: "mock-vcp-model",
  VCP_SYSTEM_PROMPT:
    "[[ContextFoldingV2]]\n[[OneRing::Smoke::VCPChat]]\n[[Smoke日记本::Time::Group::TagMemo]]",
  VCP_MEMORY_MAID: memoryMaid,
  VCP_MEMORY_OWNED_FOLDERS:
    "NuobaoChatGPT,NuobaoChatGPT的知识,Nobao-Episodes,Nobao-Projects,Nobao-Profile,Nobao-Lessons,Nobao-Archive",
  VCP_DAILYNOTE_ROOT: dailyRoot,
});

for (const [name, child] of [["mock", mock], ["mcp", mcp]]) {
  child.stdout.on("data", (d) => process.stdout.write(`[${name}] ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`[${name}:err] ${d}`));
}

try {
  await waitFor(`http://127.0.0.1:${mockPort}/healthz`);
  await waitFor(`http://127.0.0.1:${mcpPort}/healthz`);

  const client = new Client({
    name: "vcp-r0a-e2e",
    version: "0.3.0",
  });

  try {
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL(`http://127.0.0.1:${mcpPort}/mcp`)
      )
    );

    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((tool) => tool.name).sort(),
      [
        "vcp_call_tool",
        "vcp_chat",
        "vcp_memory_create",
        "vcp_memory_read",
        "vcp_memory_search",
        "vcp_memory_update",
        "vcp_status",
      ],
      "public MCP surface must remain exactly seven tools"
    );

    const statusDescriptor = tools.tools.find((tool) => tool.name === "vcp_status");
    assert.ok(statusDescriptor, "missing vcp_status descriptor");
    assert.deepEqual(Object.keys(statusDescriptor.inputSchema.properties), []);
    assert.ok(statusDescriptor.outputSchema);
    assert.deepEqual(
      Object.keys(statusDescriptor.outputSchema.properties).sort(),
      ["app_version", "models", "ok", "reachable", "schema_revision"]
    );

    const searchDescriptor = tools.tools.find((tool) => tool.name === "vcp_memory_search");
    assert.ok(searchDescriptor, "missing vcp_memory_search descriptor");
    assert.equal(Object.hasOwn(searchDescriptor.inputSchema.properties, "knowledge_base"), true);
    assert.deepEqual([...searchDescriptor.inputSchema.required].sort(), ["query"]);

    const readDescriptor = tools.tools.find((tool) => tool.name === "vcp_memory_read");
    assert.ok(readDescriptor, "missing vcp_memory_read descriptor");
    assert.deepEqual(
      Object.keys(readDescriptor.inputSchema.properties).sort(),
      ["file_name", "folder", "maid"]
    );
    assert.deepEqual([...readDescriptor.inputSchema.required].sort(), ["file_name", "folder"]);
    assert.equal(readDescriptor.inputSchema.additionalProperties, false);
    assert.equal(readDescriptor.inputSchema.properties.folder.minLength, 1);
    assert.equal(readDescriptor.inputSchema.properties.folder.maxLength, 100);
    assert.equal(readDescriptor.inputSchema.properties.file_name.minLength, 1);
    assert.equal(readDescriptor.inputSchema.properties.file_name.maxLength, 255);
    assert.ok(readDescriptor.outputSchema);
    assert.deepEqual(
      Object.keys(readDescriptor.outputSchema.properties).sort(),
      [
        "body",
        "content_sha256",
        "file_name",
        "folder",
        "memory_owner",
        "mtime_ms",
        "ok",
        "read_status",
        "size_bytes",
      ]
    );
    for (const forbidden of ["tool_name", "command", "root", "file_path", "absolute_path", "relative_path", "knowledge_base"]) {
      assert.equal(Object.hasOwn(readDescriptor.inputSchema.properties, forbidden), false);
    }
    assert.equal(readDescriptor.annotations.readOnlyHint, true);
    assert.equal(readDescriptor.annotations.destructiveHint, false);
    assert.equal(readDescriptor.annotations.openWorldHint, false);

    const updateDescriptor = tools.tools.find((tool) => tool.name === "vcp_memory_update");
    assert.ok(updateDescriptor, "missing vcp_memory_update descriptor");
    assert.deepEqual(
      Object.keys(updateDescriptor.inputSchema.properties).sort(),
      ["folder", "replace", "target"]
    );
    assert.deepEqual([...updateDescriptor.inputSchema.required].sort(), ["folder", "replace", "target"]);
    assert.equal(updateDescriptor.inputSchema.additionalProperties, false);
    assert.equal(updateDescriptor.inputSchema.properties.target.minLength, 30);
    assert.equal(updateDescriptor.inputSchema.properties.target.maxLength, 64 * 1024);
    assert.equal(updateDescriptor.inputSchema.properties.replace.minLength, 1);
    assert.equal(updateDescriptor.inputSchema.properties.replace.maxLength, 512 * 1024);
    assert.ok(updateDescriptor.outputSchema);
    for (const forbidden of ["maid", "tool_name", "command", "file_path", "absolute_path", "relative_path", "root"]) {
      assert.equal(Object.hasOwn(updateDescriptor.inputSchema.properties, forbidden), false);
    }
    assert.equal(updateDescriptor.annotations.readOnlyHint, false);
    assert.equal(updateDescriptor.annotations.destructiveHint, true);
    assert.equal(updateDescriptor.annotations.openWorldHint, false);

    const createDescriptor = tools.tools.find((tool) => tool.name === "vcp_memory_create");
    assert.ok(createDescriptor, "missing vcp_memory_create descriptor");
    assert.deepEqual(
      Object.keys(createDescriptor.inputSchema.properties).sort(),
      ["content", "date", "file_name", "folder", "maid", "tag"]
    );
    assert.deepEqual(
      [...createDescriptor.inputSchema.required].sort(),
      ["content", "date", "folder"]
    );
    assert.equal(createDescriptor.inputSchema.additionalProperties, false);
    assert.equal(createDescriptor.inputSchema.properties.folder.minLength, 1);
    assert.equal(createDescriptor.inputSchema.properties.folder.maxLength, 100);
    assert.ok(createDescriptor.outputSchema);
    assert.deepEqual(
      Object.keys(createDescriptor.outputSchema.properties).sort(),
      [
        "command",
        "file_name",
        "folder",
        "index_status",
        "memory_owner",
        "ok",
        "persistence_status",
        "retrieval_readiness",
        "tool",
      ]
    );
    for (const forbidden of ["tool_name", "command", "root", "file_path", "absolute_path", "relative_path"]) {
      assert.equal(Object.hasOwn(createDescriptor.inputSchema.properties, forbidden), false);
    }
    assert.equal(createDescriptor.annotations.readOnlyHint, false);
    assert.equal(createDescriptor.annotations.destructiveHint, false);
    assert.equal(createDescriptor.annotations.openWorldHint, false);

    const status = await client.callTool({
      name: "vcp_status",
      arguments: {},
    });
    assert.notEqual(status.isError, true);
    assert.match(textFromResult(status), /reachable/i);
    assert.equal(status.structuredContent.app_version, "0.3.0");
    assert.equal(
      status.structuredContent.schema_revision,
      "vcp-app-mcp-schema-2026-09-04-r3"
    );

    const memory = await client.callTool({
      name: "vcp_memory_search",
      arguments: {
        query: "smoke memory",
        search_all_knowledge_bases: true,
      },
    });
    assert.notEqual(memory.isError, true);
    assert.match(textFromResult(memory), /MOCK_MEMORY_RESULT/);

    async function mockStats() {
      const response = await fetch(`http://127.0.0.1:${mockPort}/stats`, {
        headers: { Authorization: "Bearer test-key" },
      });
      assert.equal(response.ok, true);
      return response.json();
    }

    const beforeRead = await mockStats();
    const read = await client.callTool({
      name: "vcp_memory_read",
      arguments: {
        folder: ownedFolder,
        file_name: path.basename(targetFile),
      },
    });
    assert.notEqual(read.isError, true);
    assert.equal(textFromResult(read), initialMemoryBody);
    assert.equal(read.structuredContent.memory_owner, memoryMaid);
    assert.equal(read.structuredContent.folder, ownedFolder);
    assert.equal(read.structuredContent.file_name, path.basename(targetFile));
    assert.equal(read.structuredContent.body, initialMemoryBody);
    assert.equal(
      read.structuredContent.content_sha256,
      crypto.createHash("sha256").update(initialMemoryBody).digest("hex")
    );
    assert.equal(read.structuredContent.size_bytes, Buffer.byteLength(initialMemoryBody, "utf8"));
    assert.equal(Number.isFinite(read.structuredContent.mtime_ms), true);
    assert.equal(read.structuredContent.read_status, "exact_stable");
    const afterRead = await mockStats();
    assert.equal(
      afterRead.humanToolCallCount,
      beforeRead.humanToolCallCount,
      "exact memory read must not call native /v1/human/tool"
    );

    const beforeReadNegatives = await mockStats();
    const readNegatives = [
      {
        name: "wrong caller owner",
        arguments: { folder: ownedFolder, file_name: path.basename(targetFile), maid: "OtherAgent" },
      },
      {
        name: "unowned folder",
        arguments: { folder: "OtherAgent", file_name: path.basename(targetFile) },
      },
      {
        name: "path traversal",
        arguments: { folder: ownedFolder, file_name: "../memory.txt" },
      },
      {
        name: "unsupported extension",
        arguments: { folder: ownedFolder, file_name: "memory.json" },
      },
      {
        name: "missing exact file",
        arguments: { folder: ownedFolder, file_name: "missing.txt" },
      },
    ];
    for (const readNegative of readNegatives) {
      const rejected = await client.callTool({
        name: "vcp_memory_read",
        arguments: readNegative.arguments,
      });
      assert.equal(rejected.isError, true, readNegative.name);
    }
    const afterReadNegatives = await mockStats();
    assert.equal(
      afterReadNegatives.humanToolCallCount,
      beforeReadNegatives.humanToolCallCount,
      "memory read authority failures must not reach native /v1/human/tool"
    );

    const beforeCreateNegatives = await mockStats();
    const createNegatives = [
      {
        name: "wrong caller owner",
        arguments: {
          date: "2026-09-01",
          content: "mock memory",
          maid: "Smoke",
          folder: ownedFolder,
          tag: "smoke",
        },
      },
      {
        name: "missing folder",
        arguments: {
          date: "2026-09-01",
          content: "mock memory",
          maid: memoryMaid,
          tag: "smoke",
        },
      },
      {
        name: "unowned folder",
        arguments: {
          date: "2026-09-01",
          content: "mock memory",
          maid: memoryMaid,
          folder: "OtherAgent",
          tag: "smoke",
        },
      },
      {
        name: "configured but missing folder",
        arguments: {
          date: "2026-09-01",
          content: "mock memory",
          folder: "Nobao-Lessons",
          tag: "smoke",
        },
      },
    ];
    for (const createNegative of createNegatives) {
      const rejected = await client.callTool({
        name: "vcp_memory_create",
        arguments: createNegative.arguments,
      });
      assert.equal(rejected.isError, true, createNegative.name);
    }
    const afterCreateNegatives = await mockStats();
    assert.equal(
      afterCreateNegatives.humanToolCallCount,
      beforeCreateNegatives.humanToolCallCount,
      "create authority failures must not reach native DailyNote"
    );

    const beforeCreate = await mockStats();
    const create = await client.callTool({
      name: "vcp_memory_create",
      arguments: {
        date: "2026-09-01",
        content: "mock memory",
        folder: ownedFolder,
        tag: "smoke",
      },
    });
    assert.notEqual(create.isError, true);
    assert.match(textFromResult(create), /MOCK_DAILYNOTE_CREATED/);
    assert.equal(create.structuredContent.memory_owner, memoryMaid);
    assert.equal(create.structuredContent.folder, ownedFolder);
    assert.equal(create.structuredContent.command, "create");
    assert.equal(create.structuredContent.tool, "DailyNote");
    assert.match(create.structuredContent.file_name, /mock\.txt$/);
    assert.equal(create.structuredContent.persistence_status, "native_confirmed");
    assert.equal(create.structuredContent.index_status, "queued");
    assert.equal(create.structuredContent.retrieval_readiness, "pending");

    const afterCreate = await mockStats();
    assert.equal(afterCreate.humanToolCallCount, beforeCreate.humanToolCallCount + 1);
    const nativeCreate = afterCreate.humanToolCalls.at(-1).body;
    assert.match(nativeCreate, /tool_name:\u300c\u59cb\u300dDailyNote\u300c\u672b\u300d/);
    assert.match(nativeCreate, /command:\u300c\u59cb\u300dcreate\u300c\u672b\u300d/);
    assert.match(nativeCreate, /maid:\u300c\u59cb\u300dNuobaoChatGPT\u300c\u672b\u300d/);
    assert.match(nativeCreate, /folder:\u300c\u59cb\u300dNuobaoChatGPT的知识\u300c\u672b\u300d/);
    assert.doesNotMatch(nativeCreate, /maid:\u300c\u59cb\u300dSmoke\u300c\u672b\u300d/);

    const createEnvelopeFailures = [
      ["explicit native create error", "__R0A_CREATE_EXPLICIT_ERROR__"],
      ["empty native create result", "__R0A_CREATE_EMPTY_RESULT__"],
      ["string native create result", "__R0A_CREATE_STRING_RESULT__"],
      ["unknown native create result", "__R0A_CREATE_UNKNOWN_RESULT__"],
      ["wrong native create folder", "__R0A_CREATE_WRONG_FOLDER__"],
      ["missing native create file name", "__R0A_CREATE_MISSING_FILENAME__"],
      ["unsafe native create file name", "__R0A_CREATE_UNSAFE_FILENAME__"],
    ];
    for (const [name, content] of createEnvelopeFailures) {
      const beforeEnvelope = await mockStats();
      const rejected = await client.callTool({
        name: "vcp_memory_create",
        arguments: {
          date: "2026-09-01",
          content,
          maid: memoryMaid,
          folder: ownedFolder,
          tag: "smoke",
        },
      });
      const afterEnvelope = await mockStats();
      assert.equal(rejected.isError, true, name);
      assert.equal(
        afterEnvelope.humanToolCallCount,
        beforeEnvelope.humanToolCallCount + 1,
        `${name} must not retry native create`
      );
    }

    const beforeUpdate = await mockStats();
    const update = await client.callTool({
      name: "vcp_memory_update",
      arguments: {
        folder: ownedFolder,
        target: updateTarget,
        replace: updateReplace,
      },
    });
    assert.notEqual(update.isError, true);
    assert.match(textFromResult(update), /MOCK_DAILYNOTE_UPDATED/);
    assert.equal(update.structuredContent.memory_owner, memoryMaid);
    assert.equal(update.structuredContent.folder, ownedFolder);
    assert.equal(update.structuredContent.file_name, path.basename(targetFile));

    const afterUpdate = await mockStats();
    assert.equal(afterUpdate.humanToolCallCount, beforeUpdate.humanToolCallCount + 1);
    const nativeUpdate = afterUpdate.humanToolCalls.at(-1).body;
    assert.match(nativeUpdate, /tool_name:「始」DailyNote「末」/);
    assert.match(nativeUpdate, /command:「始」update「末」/);
    assert.match(nativeUpdate, /maid:「始」NuobaoChatGPT「末」/);
    assert.match(nativeUpdate, /folder:「始」NuobaoChatGPT的知识「末」/);
    assert.doesNotMatch(nativeUpdate, /VCPFileOperate|DailyNoteManager|command:「始」create「末」/);

    const wrappedSuccess = await client.callTool({
      name: "vcp_memory_update",
      arguments: {
        folder: ownedFolder,
        target: updateTarget,
        replace: "__R0A_TEST_WRAPPED_SUCCESS__",
      },
    });
    assert.notEqual(wrappedSuccess.isError, true);
    assert.equal(wrappedSuccess.structuredContent.folder, ownedFolder);
    assert.equal(wrappedSuccess.structuredContent.file_name, path.basename(targetFile));

    const envelopeFailures = [
      {
        name: "empty native result",
        replace: "__R0A_TEST_EMPTY_RESULT__",
        message: /mutation target cannot be verified/i,
      },
      {
        name: "unknown native result",
        replace: "__R0A_TEST_UNKNOWN_RESULT__",
        message: /mutation target cannot be verified/i,
      },
      {
        name: "wrong native file name",
        replace: "__R0A_TEST_WRONG_FILE_NAME__",
        message: /did not confirm the preflight-selected document/i,
      },
      {
        name: "wrong native folder",
        replace: "__R0A_TEST_WRONG_FOLDER__",
        message: /did not confirm the preflight-selected document/i,
      },
      {
        name: "wrong native target file",
        replace: "__R0A_TEST_WRONG_TARGET_FILE__",
        message: /did not confirm the preflight-selected document/i,
      },
      {
        name: "explicit native failure",
        replace: "__R0A_TEST_EXPLICIT_ERROR__",
        message: /reported failure/i,
      },
    ];
    for (const envelopeCase of envelopeFailures) {
      const beforeEnvelopeCase = await mockStats();
      const rejected = await client.callTool({
        name: "vcp_memory_update",
        arguments: {
          folder: ownedFolder,
          target: updateTarget,
          replace: envelopeCase.replace,
        },
      });
      const afterEnvelopeCase = await mockStats();
      assert.equal(rejected.isError, true, envelopeCase.name);
      assert.match(textFromResult(rejected), envelopeCase.message, envelopeCase.name);
      assert.equal(
        afterEnvelopeCase.humanToolCallCount,
        beforeEnvelopeCase.humanToolCallCount + 1,
        `${envelopeCase.name} must not retry the native mutation`
      );
    }

    const beforeInjectedAuthority = await mockStats();
    const injectedAuthority = await client.callTool({
      name: "vcp_memory_update",
      arguments: {
        folder: ownedFolder,
        target: updateTarget,
        replace: updateReplace,
        maid: "OtherAgent",
        command: "create",
        tool_name: "VCPFileOperate",
        file_path: "/tmp/escape",
      },
    });
    const afterInjectedAuthority = await mockStats();
    if (injectedAuthority.isError) {
      assert.equal(
        afterInjectedAuthority.humanToolCallCount,
        beforeInjectedAuthority.humanToolCallCount
      );
    } else {
      assert.equal(
        afterInjectedAuthority.humanToolCallCount,
        beforeInjectedAuthority.humanToolCallCount + 1
      );
      const fixedNativeCall = afterInjectedAuthority.humanToolCalls.at(-1).body;
      assert.match(fixedNativeCall, /tool_name:「始」DailyNote「末」/);
      assert.match(fixedNativeCall, /command:「始」update「末」/);
      assert.match(fixedNativeCall, /maid:「始」NuobaoChatGPT「末」/);
      assert.doesNotMatch(fixedNativeCall, /OtherAgent|VCPFileOperate|\/tmp\/escape/);
    }

    const beforeNegatives = await mockStats();
    const negativeCalls = [
      { folder: ownedFolder, target: "Status: ACTIVE", replace: "replacement" },
      { target: updateTarget, replace: "replacement" },
      { folder: "微明", target: updateTarget, replace: "replacement" },
      { folder: "OtherAgent", target: updateTarget, replace: "replacement" },
      { folder: "../foo", target: updateTarget, replace: "replacement" },
      { folder: ownedFolder, target: updateTarget, replace: "" },
      {
        folder: ownedFolder,
        target: "This target is definitely long enough but is not present in any memory document.",
        replace: "replacement",
      },
      { folder: ownedFolder, target: "x".repeat(64 * 1024 + 1), replace: "replacement" },
      { folder: ownedFolder, target: "界".repeat(30_000), replace: "replacement" },
    ];
    for (const args of negativeCalls) {
      const rejected = await client.callTool({ name: "vcp_memory_update", arguments: args });
      assert.equal(rejected.isError, true, `expected rejection for ${JSON.stringify(args).slice(0, 120)}`);
    }

    await fs.writeFile(path.join(ownedFolderPath, "second.txt"), updateTarget);
    const ambiguous = await client.callTool({
      name: "vcp_memory_update",
      arguments: { folder: ownedFolder, target: updateTarget, replace: updateReplace },
    });
    assert.equal(ambiguous.isError, true);
    const afterNegatives = await mockStats();
    assert.equal(afterNegatives.humanToolCallCount, beforeNegatives.humanToolCallCount);

    const generic = await client.callTool({
      name: "vcp_call_tool",
      arguments: {
        tool_name: "EchoTool",
        arguments: { value: "hello" },
      },
    });
    assert.notEqual(generic.isError, true);
    assert.match(textFromResult(generic), /MOCK_TOOL_RESULT:EchoTool/);

    const chat = await client.callTool({
      name: "vcp_chat",
      arguments: {
        prompt: "smoke",
      },
    });
    assert.notEqual(chat.isError, true);
    assert.match(textFromResult(chat), /MOCK_VCP_CHAT_OK/);

    console.log("PASS_R0A_FULL_MOCK_E2E");
  } finally {
    await client.close().catch(() => {});
  }
} finally {
  for (const child of [mcp, mock]) {
    if (!child.killed) child.kill("SIGTERM");
  }
  await fs.rm(dailyRoot, { recursive: true, force: true });
}
