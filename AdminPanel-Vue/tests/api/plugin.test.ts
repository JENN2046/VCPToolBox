import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequestWithUi } = vi.hoisted(() => ({
  mockRequestWithUi: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/api/requestWithUi", () => ({
  requestWithUi: (...args: unknown[]) => mockRequestWithUi(...args),
}));

import { pluginApi } from "@/api/plugin";

describe("pluginApi managed write target criteria", () => {
  beforeEach(() => {
    mockRequestWithUi.mockClear();
  });

  it("includes explicit target criteria when saving plugin config", async () => {
    await pluginApi.savePluginConfig(
      "Echo",
      "ENABLED=true",
      { loadingKey: "plugin-config.save" },
      { pluginRootId: "external:0", pluginSource: "external" }
    );

    expect(mockRequestWithUi).toHaveBeenCalledWith(
      {
        url: "/admin_api/plugins/Echo/config",
        method: "POST",
        body: {
          content: "ENABLED=true",
          pluginRootId: "external:0",
          pluginSource: "external",
        },
      },
      { loadingKey: "plugin-config.save" }
    );
  });

  it("includes explicit target criteria when toggling a plugin", async () => {
    await pluginApi.togglePlugin(
      "Echo",
      false,
      { showLoader: false },
      { pluginRootId: "core:legacy", pluginSource: "core" }
    );

    expect(mockRequestWithUi).toHaveBeenCalledWith(
      {
        url: "/admin_api/plugins/Echo/toggle",
        method: "POST",
        body: {
          enable: false,
          pluginRootId: "core:legacy",
          pluginSource: "core",
        },
      },
      { showLoader: false }
    );
  });

  it("includes explicit target criteria when saving command descriptions", async () => {
    await pluginApi.saveInvocationCommandDescription(
      "Echo",
      "echo.run",
      "Run echo",
      { loadingKey: "plugin-config.command-description.save" },
      { pluginRootId: "external:1", pluginSource: "external" }
    );

    expect(mockRequestWithUi).toHaveBeenCalledWith(
      {
        url: "/admin_api/plugins/Echo/commands/echo.run/description",
        method: "POST",
        body: {
          description: "Run echo",
          pluginRootId: "external:1",
          pluginSource: "external",
        },
      },
      { loadingKey: "plugin-config.command-description.save" }
    );
  });

  it("preserves legacy payloads when target criteria are unavailable", async () => {
    await pluginApi.togglePlugin("Echo", true, { showLoader: false });

    expect(mockRequestWithUi).toHaveBeenCalledWith(
      {
        url: "/admin_api/plugins/Echo/toggle",
        method: "POST",
        body: { enable: true },
      },
      { showLoader: false }
    );
  });
});
