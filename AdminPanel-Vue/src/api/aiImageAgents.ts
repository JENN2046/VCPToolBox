import type { HttpRequest } from "@/platform/http/httpClient";
import {
  requestWithUi,
  type HttpRequestContext,
  type RequestUiOptions,
} from "./requestWithUi";

export interface AiImageDryRunRequest {
  pipelineId: string;
  taskId: string;
  plan: Record<string, unknown>;
}

export interface AiImageDryRunResult {
  ok: boolean;
  mode: string;
  status: string;
  state: Record<string, unknown> | null;
  safety: Record<string, unknown> | null;
  audit: Record<string, unknown> | null;
  error: string | null;
}

function buildDryRunRequest(
  body: AiImageDryRunRequest,
  requestContext: HttpRequestContext = {}
): HttpRequest {
  return {
    url: "/admin_api/ai-image-agents/dry-run",
    method: "POST",
    body,
    ...requestContext,
  };
}

export const aiImageAgentsApi = {
  async dryRun(
    body: AiImageDryRunRequest,
    requestContext: HttpRequestContext = {},
    uiOptions: RequestUiOptions = {}
  ): Promise<AiImageDryRunResult> {
    return requestWithUi<AiImageDryRunResult>(
      buildDryRunRequest(body, requestContext),
      uiOptions
    );
  },
};
