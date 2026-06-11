import type { Ref } from "vue";
import { useLocalStorage } from "@/composables/useLocalStorage";
import type { NavItem } from "@/stores/app";
import type { PluginInfo } from "@/types/api.plugin";

export interface RecentVisit {
  target: string;
  label: string;
  icon?: string;
  pluginName?: string;
  pluginRootId?: string;
  pluginSource?: string;
}

export interface NavigationUsageRecord {
  count: number;
  lastVisitedAt: number;
}

export type NavigationUsageMap = Record<string, NavigationUsageRecord>;

interface CreateRecentVisitOptions {
  target: string;
  navItems: readonly NavItem[];
  plugins: readonly PluginInfo[];
  pluginName?: string;
  pluginRootId?: string;
  pluginSource?: string;
}

interface PushNavigationUsageOptions {
  target: string;
  pluginName?: string;
  pluginRootId?: string;
  pluginSource?: string;
  timestamp?: number;
}

interface RecordNavigationVisitOptions extends CreateRecentVisitOptions {
  recentVisits: readonly RecentVisit[];
  navigationUsage: Readonly<NavigationUsageMap>;
  timestamp?: number;
}

export const RECENT_VISITS_STORAGE_KEY = "sidebarRecentVisits";
export const RECENT_VISITS_LIMIT = 5;
export const NAVIGATION_USAGE_STORAGE_KEY = "navigationUsage";

function getPluginName(plugin: PluginInfo): string {
  return plugin.manifest.name || plugin.name;
}

function getPluginDisplayName(plugin: PluginInfo): string {
  return plugin.manifest.displayName?.trim() || getPluginName(plugin);
}

function getPluginByName(
  plugins: readonly PluginInfo[],
  pluginName: string,
  criteria?: { pluginRootId?: string; pluginSource?: string }
): PluginInfo | undefined {
  return plugins.find((plugin) =>
    getPluginName(plugin) === pluginName &&
    (!criteria?.pluginRootId || plugin.pluginRootId === criteria.pluginRootId) &&
    (!criteria?.pluginSource || plugin.pluginSource === criteria.pluginSource)
  );
}

function getPluginVisitKey(visit: Pick<RecentVisit, "pluginName" | "pluginRootId" | "pluginSource">): string {
  return [
    visit.pluginName || "",
    visit.pluginRootId || "",
    visit.pluginSource || "",
  ].join(":");
}

export function createRecentVisit({
  target,
  navItems,
  plugins,
  pluginName,
  pluginRootId,
  pluginSource,
}: CreateRecentVisitOptions): RecentVisit | null {
  if (pluginName) {
    const plugin = getPluginByName(plugins, pluginName, { pluginRootId, pluginSource });
    if (!plugin) {
      return null;
    }

    const resolvedPluginName = getPluginName(plugin);
    return {
      target: `plugin-${resolvedPluginName}-config`,
      label: getPluginDisplayName(plugin),
      icon: plugin.manifest.icon || "extension",
      pluginName: resolvedPluginName,
      pluginRootId: plugin.pluginRootId,
      pluginSource: plugin.pluginSource,
    };
  }

  const navItem = navItems.find((item) => item.target === target && item.label);
  if (!navItem?.label) {
    return null;
  }

  return {
    target,
    label: navItem.label,
    icon: navItem.icon,
    pluginName: navItem.pluginName,
  };
}

export function pushRecentVisit(
  recentVisits: readonly RecentVisit[],
  nextVisit: RecentVisit,
  limit = RECENT_VISITS_LIMIT
): RecentVisit[] {
  const nextVisits = recentVisits.filter((item) =>
    nextVisit.pluginName
      ? getPluginVisitKey(item) !== getPluginVisitKey(nextVisit)
      : item.target !== nextVisit.target
  );

  return [nextVisit, ...nextVisits].slice(0, limit);
}

export function getNavigationUsageKey(
  target: string,
  pluginName?: string,
  targetCriteria?: { pluginRootId?: string; pluginSource?: string }
): string {
  return pluginName
    ? `plugin:${pluginName}:${targetCriteria?.pluginRootId || ""}:${targetCriteria?.pluginSource || ""}`
    : `page:${target}`;
}

export function pushNavigationUsage(
  navigationUsage: Readonly<NavigationUsageMap>,
  {
    target,
    pluginName,
    pluginRootId,
    pluginSource,
    timestamp = Date.now(),
  }: PushNavigationUsageOptions
): NavigationUsageMap {
  const usageKey = getNavigationUsageKey(target, pluginName, { pluginRootId, pluginSource });
  const currentRecord = navigationUsage[usageKey];

  return {
    ...navigationUsage,
    [usageKey]: {
      count: (currentRecord?.count ?? 0) + 1,
      lastVisitedAt: timestamp,
    },
  };
}

export function recordNavigationVisit({
  target,
  navItems,
  plugins,
  recentVisits,
  navigationUsage,
  pluginName,
  pluginRootId,
  pluginSource,
  timestamp,
}: RecordNavigationVisitOptions): {
  recentVisits: RecentVisit[];
  navigationUsage: NavigationUsageMap;
} {
  const nextNavigationUsage = pushNavigationUsage(navigationUsage, {
    target,
    pluginName,
    pluginRootId,
    pluginSource,
    timestamp,
  });
  const nextVisit = createRecentVisit({
    target,
    navItems,
    plugins,
    pluginName,
    pluginRootId,
    pluginSource,
  });

  return {
    recentVisits: nextVisit
      ? pushRecentVisit(recentVisits, nextVisit)
      : [...recentVisits],
    navigationUsage: nextNavigationUsage,
  };
}

export function useRecentVisits(): Ref<RecentVisit[]> {
  return useLocalStorage<RecentVisit[]>(RECENT_VISITS_STORAGE_KEY, []);
}

export function useNavigationUsage(): Ref<NavigationUsageMap> {
  return useLocalStorage<NavigationUsageMap>(NAVIGATION_USAGE_STORAGE_KEY, {});
}
