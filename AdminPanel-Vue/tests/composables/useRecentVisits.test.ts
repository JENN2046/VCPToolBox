import { describe, expect, it } from "vitest";
import {
  createRecentVisit,
  getNavigationUsageKey,
  pushRecentVisit,
  recordNavigationVisit,
} from "@/composables/useRecentVisits";
import type { PluginInfo } from "@/types/api.plugin";

function makePlugin(overrides: Partial<PluginInfo>): PluginInfo {
  return {
    name: "Echo",
    manifest: {
      name: "Echo",
      displayName: "Echo",
    },
    enabled: true,
    ...overrides,
  };
}

describe("recent plugin visits target criteria", () => {
  it("records explicit plugin root and source for duplicate plugin names", () => {
    const plugins = [
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
    ];

    const visit = createRecentVisit({
      target: "plugin-Echo-config",
      navItems: [],
      plugins,
      pluginName: "Echo",
      pluginRootId: "external:0",
      pluginSource: "external",
    });

    expect(visit).toMatchObject({
      target: "plugin-Echo-config",
      label: "External Echo",
      pluginName: "Echo",
      pluginRootId: "external:0",
      pluginSource: "external",
    });
  });

  it("keeps same-name plugin visits separate by root identity", () => {
    const visits = pushRecentVisit(
      [
        {
          target: "plugin-Echo-config",
          label: "Core Echo",
          pluginName: "Echo",
          pluginRootId: "core:legacy",
          pluginSource: "core",
        },
      ],
      {
        target: "plugin-Echo-config",
        label: "External Echo",
        pluginName: "Echo",
        pluginRootId: "external:0",
        pluginSource: "external",
      }
    );

    expect(visits).toHaveLength(2);
    expect(visits.map((visit) => visit.pluginRootId)).toEqual([
      "external:0",
      "core:legacy",
    ]);
  });

  it("tracks usage by explicit plugin target", () => {
    expect(
      getNavigationUsageKey("plugin-Echo-config", "Echo", {
        pluginRootId: "external:0",
        pluginSource: "external",
      })
    ).toBe("plugin:Echo:external:0:external");

    const result = recordNavigationVisit({
      target: "plugin-Echo-config",
      navItems: [],
      plugins: [
        makePlugin({
          pluginRootId: "external:0",
          pluginSource: "external",
        }),
      ],
      recentVisits: [],
      navigationUsage: {},
      pluginName: "Echo",
      pluginRootId: "external:0",
      pluginSource: "external",
      timestamp: 1,
    });

    expect(result.navigationUsage["plugin:Echo:external:0:external"]).toEqual({
      count: 1,
      lastVisitedAt: 1,
    });
    expect(result.recentVisits[0]?.pluginRootId).toBe("external:0");
  });
});
