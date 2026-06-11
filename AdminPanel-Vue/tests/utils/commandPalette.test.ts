import { describe, expect, it } from "vitest";
import { buildCommandPaletteIndex } from "@/utils/commandPalette";
import type { PluginInfo } from "@/types/api.plugin";

function makePlugin(overrides: Partial<PluginInfo>): PluginInfo {
  return {
    name: "Echo",
    manifest: {
      name: "Echo",
      displayName: "Echo",
      description: "Echo plugin",
    },
    enabled: true,
    ...overrides,
  };
}

describe("command palette plugin target criteria", () => {
  it("keeps duplicate plugin names distinct by root and source", () => {
    const index = buildCommandPaletteIndex({
      navItems: [],
      plugins: [
        makePlugin({
          manifest: {
            name: "Echo",
            displayName: "Core Echo",
          },
          pluginRootId: "core:legacy",
          pluginSource: "core",
        }),
        makePlugin({
          manifest: {
            name: "Echo",
            displayName: "External Echo",
          },
          pluginRootId: "external:0",
          pluginSource: "external",
        }),
      ],
      recentVisits: [
        {
          target: "plugin-Echo-config",
          label: "External Echo",
          pluginName: "Echo",
          pluginRootId: "external:0",
          pluginSource: "external",
        },
      ],
      navigationUsage: {},
      pinnedPluginNames: [],
    });

    expect(index.pluginEntries.map((entry) => entry.id).sort()).toEqual([
      "plugin:Echo:core:legacy:core",
      "plugin:Echo:external:0:external",
    ]);

    expect(index.recentEntries[0]).toMatchObject({
      id: "recent:plugin:Echo:external:0:external",
      label: "External Echo",
      pluginName: "Echo",
      pluginRootId: "external:0",
      pluginSource: "external",
    });
  });
});
