import http from "node:http";

const host = process.env.MOCK_VCP_HOST || "127.0.0.1";
const port = Number(process.env.MOCK_VCP_PORT || 16005);
const key = process.env.MOCK_VCP_KEY || "test-key";

function json(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function toolNameFromBody(text) {
  const m = text.match(/tool_name:「始」([\s\S]*?)「末」/);
  return m ? m[1] : "";
}

function toolArgFromBody(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`${escaped}:「始」([\\s\\S]*?)「末」`));
  return match ? match[1] : "";
}

const humanToolCalls = [];

const server = http.createServer(async (req, res) => {
  if (req.url === "/healthz") {
    return json(res, 200, { ok: true });
  }

  if (req.headers.authorization !== `Bearer ${key}`) {
    return json(res, 401, { error: "unauthorized" });
  }

  if (req.method === "GET" && req.url === "/stats") {
    return json(res, 200, {
      humanToolCallCount: humanToolCalls.length,
      humanToolCalls,
    });
  }

  if (req.method === "GET" && req.url === "/v1/models") {
    return json(res, 200, {
      object: "list",
      data: [{ id: "mock-vcp-model", object: "model" }],
    });
  }

  if (req.method === "POST" && req.url === "/v1/human/tool") {
    const body = await readBody(req);
    const toolName = toolNameFromBody(body);
    humanToolCalls.push({ toolName, body });

    if (toolName === "LightMemo") {
      return json(res, 200, {
        status: "success",
        result: "MOCK_MEMORY_RESULT",
      });
    }

    if (toolName === "DailyNote") {
      const command = toolArgFromBody(body, "command").toLowerCase();
      if (command === "update") {
        const folder = toolArgFromBody(body, "folder");
        const replace = toolArgFromBody(body, "replace");
        const targetFile = process.env.MOCK_DAILYNOTE_TARGET_FILE || "";
        const fileName = process.env.MOCK_DAILYNOTE_TARGET_NAME || "memory.txt";
        const success = {
          message: "MOCK_DAILYNOTE_UPDATED",
          targetFile,
          folder,
          fileName,
          indexStatus: "queued",
        };

        switch (replace) {
          case "__R0A_TEST_WRAPPED_SUCCESS__":
            return json(res, 200, {
              status: "success",
              result: {
                ...success,
                targetFile:
                  process.env.MOCK_DAILYNOTE_WRAPPED_TARGET_FILE || targetFile,
              },
            });
          case "__R0A_TEST_EMPTY_RESULT__":
            return json(res, 200, {});
          case "__R0A_TEST_UNKNOWN_RESULT__":
            return json(res, 200, { foo: "bar" });
          case "__R0A_TEST_WRONG_FILE_NAME__":
            return json(res, 200, { ...success, fileName: `other-${fileName}` });
          case "__R0A_TEST_WRONG_FOLDER__":
            return json(res, 200, { ...success, folder: "Nobao-Archive" });
          case "__R0A_TEST_WRONG_TARGET_FILE__":
            return json(res, 200, { ...success, targetFile: `${targetFile}.other` });
          case "__R0A_TEST_EXPLICIT_ERROR__":
            return json(res, 200, { status: "error", error: "mock explicit failure" });
          default:
            return json(res, 200, success);
        }
      }

      if (command === "create") {
        const folder = toolArgFromBody(body, "folder");
        const content = toolArgFromBody(body, "Content");
        const success = {
          message: "MOCK_DAILYNOTE_CREATED",
          folder,
          fileName: "2026-09-01-00_00_00-mock.txt",
          indexStatus: "queued",
        };

        switch (content) {
          case "__R0A_CREATE_EXPLICIT_ERROR__":
            return json(res, 200, { status: "error", error: "mock create failure" });
          case "__R0A_CREATE_EMPTY_RESULT__":
            return json(res, 200, {});
          case "__R0A_CREATE_STRING_RESULT__":
            return json(res, 200, { status: "success", result: "MOCK_DAILYNOTE_CREATED" });
          case "__R0A_CREATE_UNKNOWN_RESULT__":
            return json(res, 200, { foo: "bar" });
          case "__R0A_CREATE_WRONG_FOLDER__":
            return json(res, 200, {
              status: "success",
              result: { ...success, folder: "Nobao-Archive" },
            });
          case "__R0A_CREATE_MISSING_FILENAME__":
            return json(res, 200, {
              status: "success",
              result: { ...success, fileName: "" },
            });
          case "__R0A_CREATE_UNSAFE_FILENAME__":
            return json(res, 200, {
              status: "success",
              result: { ...success, fileName: "../escape.txt" },
            });
          default:
            return json(res, 200, { status: "success", result: success });
        }
      }

      return json(res, 200, { status: "error", error: "unsupported DailyNote command" });
    }

    return json(res, 200, {
      status: "success",
      result: `MOCK_TOOL_RESULT:${toolName}`,
    });
  }

  if (
    req.method === "POST" &&
    (req.url === "/v1/chat/completions" ||
      req.url === "/v1/chatvcp/completions")
  ) {
    const raw = await readBody(req);
    const body = JSON.parse(raw || "{}");
    const system = (body.messages || [])
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n");

    return json(res, 200, {
      id: "mock-chat",
      object: "chat.completion",
      model: body.model || "mock-vcp-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "MOCK_VCP_CHAT_OK",
          },
          finish_reason: "stop",
        },
      ],
      mock_context_markers: {
        contextFolding: system.includes("[[ContextFoldingV2]]"),
        oneRing: system.includes("[[OneRing::Smoke::VCPChat]]"),
        tagMemo: system.includes("[[Smoke日记本::Time::Group::TagMemo]]"),
      },
    });
  }

  json(res, 404, { error: "not found", path: req.url });
});

server.listen(port, host, () => {
  console.log(`[mock-vcp] http://${host}:${port}`);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
