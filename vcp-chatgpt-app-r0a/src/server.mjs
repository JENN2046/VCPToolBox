import express from "express";
import path from "node:path";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { config } from "./config.mjs";
import { VcpClient, VcpHttpError } from "./vcp-client.mjs";
import {
  MEMORY_READ_LIMITS,
  MEMORY_UPDATE_LIMITS,
  MemoryAuthorityError,
  assertMemoryOwnerAssertion,
  assertUtf8Limit,
  preflightMemoryCreate,
  preflightMemoryRead,
  preflightMemoryUpdate,
  resolveMemoryAuthority,
  verifyMemoryPreflight,
} from "./memory-authority.mjs";

const VCP_APP_VERSION = "0.3.0";
const VCP_APP_SCHEMA_REVISION = "vcp-app-mcp-schema-2026-09-04-r3";

const vcp = new VcpClient({
  baseUrl: config.vcpBaseUrl,
  apiKey: config.vcpApiKey,
  timeoutMs: config.vcpTimeoutMs,
  chatPath: config.vcpChatPath,
  defaultModel: config.vcpDefaultModel,
  systemPrompt: config.vcpSystemPrompt,
});

function modelList(data) {
  return Array.isArray(data?.data)
    ? data.data.map((item) => item?.id).filter(Boolean)
    : [];
}

function resolveNativeDailyNoteTarget(targetFile, dailyNoteRoot) {
  const raw = String(targetFile || "").trim();
  if (!raw) return null;

  if (path.isAbsolute(raw)) {
    return path.resolve(raw);
  }

  const normalized = raw.replaceAll("\\", "/");
  const root = path.resolve(dailyNoteRoot);
  const rootBase = path.basename(root);

  let relative = normalized;
  if (relative.startsWith(`${rootBase}/`)) {
    relative = relative.slice(rootBase.length + 1);
  }

  return path.resolve(root, relative);
}

function isSafeNativeFileName(fileName) {
  if (typeof fileName !== "string" || !fileName) return false;
  if (fileName === "." || fileName === "..") return false;
  if (path.isAbsolute(fileName) || path.win32.isAbsolute(fileName)) return false;
  if (path.basename(fileName) !== fileName) return false;
  if (path.win32.basename(fileName) !== fileName) return false;
  return !fileName.includes("/") && !fileName.includes("\\");
}

function resultText(value) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function successResult(text, structuredContent = {}) {
  return {
    structuredContent,
    content: [{ type: "text", text }],
  };
}

function errorResult(error, { structured = true } = {}) {
  const detail =
    error instanceof VcpHttpError
      ? {
          type: error.name,
          message: error.message,
          status: error.status ?? null,
          path: error.path ?? null,
          body: error.body ?? null,
        }
      : error instanceof MemoryAuthorityError
        ? {
            type: error.name,
            code: error.code,
            message: error.message,
          }
      : {
          type: error?.name || "Error",
          message: error?.message || String(error),
        };

  const result = {
    isError: true,
    content: [{ type: "text", text: `VCP call failed: ${detail.message}` }],
  };
  if (structured) {
    result.structuredContent = { ok: false, error: detail };
  }
  return result;
}

function guarded(handler, { structuredErrors = true } = {}) {
  return async (args) => {
    try {
      return await handler(args);
    } catch (error) {
      console.error("[tool]", error);
      return errorResult(error, { structured: structuredErrors });
    }
  };
}

function createMcpServer() {
  const server = new McpServer(
    {
      name: "vcp-app",
      version: VCP_APP_VERSION,
    },
    {
      instructions:
        "VCP-APP direct integration. Use vcp_memory_search for semantic memory retrieval. Use vcp_memory_read for an exact stable readback of one server-authorized Hot DailyNote document. Use vcp_memory_create only when the user explicitly wants a new persistent memory written. Use vcp_memory_update only when the user explicitly wants an existing persistent memory updated. Use vcp_call_tool for other known VCP native tools. Use vcp_chat when the request should enter VCP's full chat/message-preprocessor/tool-loop pipeline.",
    }
  );

  server.registerTool(
    "vcp_status",
    {
      title: "Check VCP connectivity",
      description:
        "Use this to verify that VCP-APP can authenticate to the VCPToolBox main server, retrieve its model list, and report the live app/schema revision for stale-session diagnosis.",
      inputSchema: {},
      outputSchema: {
        ok: z.literal(true),
        reachable: z.literal(true),
        app_version: z.string(),
        schema_revision: z.string(),
        models: z.array(z.string()),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    guarded(async () => {
      const data = await vcp.listModels();
      const models = modelList(data);
      return successResult(
        `VCP :6005 is reachable and authenticated. ${models.length} model(s) reported.`,
        {
          ok: true,
          reachable: true,
          app_version: VCP_APP_VERSION,
          schema_revision: VCP_APP_SCHEMA_REVISION,
          models,
        }
      );
    })
  );

  server.registerTool(
    "vcp_memory_read",
    {
      title: "Read one exact VCP memory document",
      description:
        "Use this for authoritative exact readback of one existing server-authorized Hot DailyNote document after its exact folder and file name are known. This is read-only and does not perform semantic retrieval or Cold TDB routing.",
      inputSchema: {
        folder: z.string().min(1).max(100),
        file_name: z.string().min(1).max(MEMORY_READ_LIMITS.fileNameMaxChars),
        maid: z.string().min(1).optional(),
      },
      outputSchema: {
        ok: z.literal(true),
        memory_owner: z.string(),
        folder: z.string(),
        file_name: z.string(),
        body: z.string(),
        content_sha256: z.string().regex(/^[a-f0-9]{64}$/u),
        size_bytes: z.number().int().nonnegative(),
        mtime_ms: z.number().nonnegative(),
        read_status: z.literal("exact_stable"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    guarded(async ({ folder, file_name, maid }) => {
      const authority = resolveMemoryAuthority(config);
      assertMemoryOwnerAssertion(maid, authority.maid);
      const snapshot = await preflightMemoryRead({
        root: authority.root,
        ownedFolders: authority.ownedFolders,
        folder,
        fileName: file_name,
      });

      return successResult(snapshot.content, {
        ok: true,
        memory_owner: authority.maid,
        folder: snapshot.folder,
        file_name: snapshot.name,
        body: snapshot.content,
        content_sha256: snapshot.sha256,
        size_bytes: snapshot.size,
        mtime_ms: snapshot.mtimeMs,
        read_status: "exact_stable",
      });
    }, { structuredErrors: false })
  );

  server.registerTool(
    "vcp_memory_update",
    {
      title: "Update an existing VCP-APP memory",
      description:
        "Use only when the user explicitly wants an existing server-authorized VCP-APP DailyNote memory persistently updated. The target must identify exactly one literal occurrence in one server-authorized memory document; zero or ambiguous matches fail without mutation.",
      inputSchema: {
        folder: z.string().min(1).max(100),
        target: z
          .string()
          .min(MEMORY_UPDATE_LIMITS.targetMinChars)
          .max(MEMORY_UPDATE_LIMITS.targetMaxChars),
        replace: z
          .string()
          .min(MEMORY_UPDATE_LIMITS.replaceMinChars)
          .max(MEMORY_UPDATE_LIMITS.replaceMaxChars),
      },
      outputSchema: {
        ok: z.literal(true),
        tool: z.literal("DailyNote"),
        command: z.literal("update"),
        memory_owner: z.string(),
        folder: z.string(),
        file_name: z.string(),
        index_status: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
        idempotentHint: false,
      },
    },
    guarded(async ({ folder, target, replace }) => {
      assertUtf8Limit(target, MEMORY_UPDATE_LIMITS.targetMaxBytes, "target");
      assertUtf8Limit(replace, MEMORY_UPDATE_LIMITS.replaceMaxBytes, "replace");

      const authority = resolveMemoryAuthority(config);
      const preflight = await preflightMemoryUpdate({
        root: authority.root,
        ownedFolders: authority.ownedFolders,
        folder,
        target,
      });
      await verifyMemoryPreflight(preflight);

      const data = await vcp.memoryUpdate({
        maid: authority.maid,
        folder,
        target,
        replace,
      });

      if (data?.status === "error" || data?.ok === false || data?.error) {
        throw new MemoryAuthorityError(
          "MEMORY_NATIVE_UPDATE_FAILED",
          "Native DailyNote update reported failure."
        );
      }

      const nativeResult =
        data?.status === "success" &&
        data?.result &&
        typeof data.result === "object" &&
        !Array.isArray(data.result)
          ? data.result
          : data;

      if (
        !nativeResult ||
        typeof nativeResult !== "object" ||
        Array.isArray(nativeResult)
      ) {
        throw new MemoryAuthorityError(
          "MEMORY_NATIVE_UPDATE_RESULT_UNVERIFIED",
          "Native DailyNote update returned a result whose mutation target cannot be verified."
        );
      }

      const nativeFolder = String(nativeResult.folder || "");
      const nativeFileName = String(nativeResult.fileName || "");
      const nativeTarget = resolveNativeDailyNoteTarget(
        nativeResult.targetFile,
        authority.root
      );

      if (!nativeFolder || !nativeFileName || !nativeTarget) {
        throw new MemoryAuthorityError(
          "MEMORY_NATIVE_UPDATE_RESULT_UNVERIFIED",
          "Native DailyNote update returned a result whose mutation target cannot be verified."
        );
      }

      const expectedTarget = path.resolve(preflight.filePath);
      if (
        nativeFolder !== preflight.folder ||
        nativeFileName !== preflight.fileName ||
        nativeTarget !== expectedTarget
      ) {
        throw new MemoryAuthorityError(
          "MEMORY_NATIVE_TARGET_MISMATCH",
          "Native DailyNote did not confirm the preflight-selected document."
        );
      }

      const message =
        typeof nativeResult.message === "string" && nativeResult.message
          ? nativeResult.message
          : `Updated ${preflight.folder}/${preflight.fileName}.`;
      return successResult(message, {
        ok: true,
        tool: "DailyNote",
        command: "update",
        memory_owner: authority.maid,
        folder: preflight.folder,
        file_name: preflight.fileName,
        index_status: nativeResult.indexStatus || "queued",
      });
    }, { structuredErrors: false })
  );

  server.registerTool(
    "vcp_memory_search",
    {
      title: "Search VCP memory",
      description:
        "Use this when the user wants to recall VCP memory through LightMemo. Use folder/maid for Hot DailyNote scope and knowledge_base for Cold TDB library scope; folder is never interpreted as a Cold library. This is read-only.",
      inputSchema: {
        query: z.string().min(1),
        folder: z.string().optional(),
        knowledge_base: z.string().min(1).optional(),
        maid: z.string().optional(),
        k: z.number().int().min(1).max(25).default(5),
        enginemode: z.enum(["rivermemo", "tagmemo", "knn"]).default("rivermemo"),
        rerank: z.union([z.boolean(), z.number().min(0).max(1), z.string()]).default(false),
        bm25: z.boolean().default(true),
        search_all_knowledge_bases: z.boolean().default(false),
        aimemo: z.union([z.boolean(), z.string()]).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    guarded(async ({
      query,
      folder,
      knowledge_base,
      maid,
      k,
      enginemode,
      rerank,
      bm25,
      search_all_knowledge_bases,
      aimemo,
    }) => {
      const data = await vcp.memorySearch({
        query,
        folder,
        knowledgeBase: knowledge_base,
        maid,
        k,
        enginemode,
        rerank,
        bm25,
        searchAll: search_all_knowledge_bases,
        aimemo,
      });
      const result = data?.result ?? data;
      return successResult(resultText(result), {
        ok: true,
        tool: "LightMemo",
        result,
      });
    })
  );

  server.registerTool(
    "vcp_memory_create",
    {
      title: "Create a VCP memory",
      description:
        "Use this only when the user explicitly wants the current information persisted into a server-authorized VCP DailyNote memory namespace.",
      inputSchema: {
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        content: z.string().min(1),
        maid: z.string().min(1).optional(),
        folder: z.string().min(1).max(100),
        file_name: z.string().optional(),
        tag: z.string().optional(),
      },
      outputSchema: {
        ok: z.literal(true),
        tool: z.literal("DailyNote"),
        command: z.literal("create"),
        memory_owner: z.string(),
        folder: z.string(),
        file_name: z.string(),
        persistence_status: z.literal("native_confirmed"),
        index_status: z.string(),
        retrieval_readiness: z.enum(["pending", "unverified"]),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: false,
      },
    },
    guarded(async ({ date, content, maid, folder, file_name, tag }) => {
      const authority = resolveMemoryAuthority(config);
      assertMemoryOwnerAssertion(maid, authority.maid);
      const preflight = await preflightMemoryCreate({
        root: authority.root,
        ownedFolders: authority.ownedFolders,
        folder,
      });

      const data = await vcp.memoryCreate({
        date,
        content,
        maid: authority.maid,
        folder: preflight.folder,
        fileName: file_name,
        tag,
      });

      if (data?.status === "error" || data?.ok === false || data?.error) {
        throw new MemoryAuthorityError(
          "MEMORY_NATIVE_CREATE_FAILED",
          "Native DailyNote create reported failure."
        );
      }

      const nativeResult =
        data?.status === "success" &&
        data?.result &&
        typeof data.result === "object" &&
        !Array.isArray(data.result)
          ? data.result
          : data;

      if (
        !nativeResult ||
        typeof nativeResult !== "object" ||
        Array.isArray(nativeResult)
      ) {
        throw new MemoryAuthorityError(
          "MEMORY_NATIVE_CREATE_RESULT_UNVERIFIED",
          "Native DailyNote create returned a result whose mutation target cannot be verified."
        );
      }

      const nativeFolder = nativeResult.folder;
      const nativeFileName = nativeResult.fileName;
      if (
        typeof nativeFolder !== "string" ||
        !nativeFolder ||
        !isSafeNativeFileName(nativeFileName)
      ) {
        throw new MemoryAuthorityError(
          "MEMORY_NATIVE_CREATE_RESULT_UNVERIFIED",
          "Native DailyNote create returned a result whose mutation target cannot be verified."
        );
      }
      if (nativeFolder !== preflight.folder) {
        throw new MemoryAuthorityError(
          "MEMORY_NATIVE_TARGET_MISMATCH",
          "Native DailyNote create did not confirm the preflight-approved folder."
        );
      }

      const message =
        typeof nativeResult.message === "string" && nativeResult.message
          ? nativeResult.message
          : `Created ${preflight.folder}/${nativeFileName}.`;
      const indexStatus =
        typeof nativeResult.indexStatus === "string" && nativeResult.indexStatus.trim()
          ? nativeResult.indexStatus.trim()
          : "queued";
      const retrievalReadiness =
        indexStatus.toLowerCase() === "queued" ? "pending" : "unverified";
      return successResult(message, {
        ok: true,
        tool: "DailyNote",
        command: "create",
        memory_owner: authority.maid,
        folder: preflight.folder,
        file_name: nativeFileName,
        persistence_status: "native_confirmed",
        index_status: indexStatus,
        retrieval_readiness: retrievalReadiness,
      });
    }, { structuredErrors: false })
  );

  server.registerTool(
    "vcp_call_tool",
    {
      title: "Call any VCP native tool",
      description:
        "Use this when the exact VCP native plugin/tool name is known and no more specific MCP tool exists. It forwards to /v1/human/tool.",
      inputSchema: {
        tool_name: z.string().min(1),
        arguments: z.record(z.any()).default({}),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    guarded(async ({ tool_name, arguments: args }) => {
      const data = await vcp.callTool(tool_name, args);
      const result = data?.result ?? data;
      return successResult(resultText(result), {
        ok: true,
        tool: tool_name,
        result,
      });
    })
  );

  server.registerTool(
    "vcp_chat",
    {
      title: "Run the full VCP pipeline",
      description:
        "Use this when the request should enter VCPToolBox /v1/chat/completions, including configured message preprocessors, RAG/TagMemo/RiverMemo/OneRing/Timeline/ContextFolding activation present in the configured VCP system prompt, and VCP's own tool loop.",
      inputSchema: {
        prompt: z.string().min(1),
        model: z.string().optional(),
        system: z.string().optional(),
        temperature: z.number().min(0).max(2).optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    guarded(async ({ prompt, model, system, temperature }) => {
      const data = await vcp.chat({ prompt, model, system, temperature });
      const content =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.text ??
        data;

      return successResult(resultText(content), {
        ok: true,
        model: data?.model ?? model ?? config.vcpDefaultModel ?? "",
        response: content,
      });
    })
  );

  return server;
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "vcp-chatgpt-app-r0a",
    version: "0.3.0",
    mcp: "/mcp",
    upstream: config.vcpBaseUrl,
  });
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "vcp-chatgpt-app-r0a" });
});

app.get("/readyz", async (_req, res) => {
  try {
    const data = await vcp.listModels();
    res.json({ ok: true, models: modelList(data) });
  } catch (error) {
    res.status(503).json({
      ok: false,
      error: error?.message || String(error),
    });
  }
});

app.post("/mcp", async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    Promise.resolve(transport.close()).catch(() => {});
    Promise.resolve(server.close()).catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("[mcp]", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        id: req.body?.id ?? null,
        error: {
          code: -32603,
          message: error?.message || "Internal MCP error",
        },
      });
    }
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({
    error: "Stateless MCP endpoint: POST is supported; standalone GET stream is not enabled.",
  });
});

app.delete("/mcp", (_req, res) => {
  res.status(405).json({
    error: "Stateless MCP endpoint: sessions are disabled.",
  });
});

app.listen(config.port, config.host, () => {
  console.log(
    `[R0-A] MCP listening on http://${config.host}:${config.port}/mcp`
  );
  console.log(`[R0-A] Direct VCP upstream: ${config.vcpBaseUrl}`);
  console.log(`[R0-A] VCP chat path: ${config.vcpChatPath}`);
  console.log(
    `[R0-A] Fixed VCP system prompt: ${config.vcpSystemPrompt ? "loaded" : "not configured"}`
  );
});
