import {
  requestWithUi,
  type RequestUiOptions,
} from "./requestWithUi";

const DEFAULT_READ_UI_OPTIONS: RequestUiOptions = { showLoader: false };

export interface CodexMemoryOverviewPaths {
  auditLogPath: string;
  recallLogPath: string;
  processDiaryPath: string;
  knowledgeDiaryPath: string;
}

export interface CodexMemoryWriteSummary {
  sampleSize: number;
  accepted: number;
  rejected: number;
  processAccepted: number;
  knowledgeAccepted: number;
  processRejected: number;
  knowledgeRejected: number;
  blockedDirectWrites: number;
  sensitiveRejected: number;
  latestAcceptedAt: string | null;
  latestRejectedAt: string | null;
}

export interface CodexMemoryRecallSummary {
  sampleSize: number;
  totalHits: number;
  processHits: number;
  knowledgeHits: number;
  snippetHits: number;
  fullTextHits: number;
  directHits: number;
  cacheHits: number;
  latestHitAt: string | null;
  latestProcessHitAt: string | null;
  latestKnowledgeHitAt: string | null;
}

export interface CodexMemoryRecallEntry {
  timestamp: string | null;
  dbName: string | null;
  target: string | null;
  recallType: string;
  resultCount: number;
  topScore: number | null;
  topMemoryId: string | null;
  topMatchedTags: string[];
  matchedTags: string[];
  coreTags: string[];
  topSourceFile: string | null;
  memoryIds: string[];
  fromCache: boolean;
  sourceKinds: string[];
  sourceFiles: string[];
}

export interface CodexMemoryAdaptiveProfile {
  dbName: string;
  target: string;
  enabled: boolean;
  writeCount: number;
  totalHits: number;
  snippetHits: number;
  fullTextHits: number;
  directHits: number;
  cacheHits: number;
  avgTopScore: number | null;
  hitRate: number;
  thresholdDelta: number;
  tagWeightDelta: number;
  kDelta: number;
  truncationDelta: number;
  lowScorePenalty: number;
  lastWriteAt: string | null;
  lastHitAt: string | null;
  status: string;
  reasons: string[];
}

export interface CodexMemoryTagContribution {
  dbName: string;
  target: string;
  tag: string;
  hitCount: number;
  matchedHitCount: number;
  coreHitCount: number;
  cacheHits: number;
  avgTopScore: number | null;
  latestHitAt: string | null;
  uniqueMemoryCount: number;
}

export interface CodexMemoryLink {
  memoryId: string | null;
  title: string;
  target: string | null;
  filePath: string | null;
  writtenAt: string | null;
  recallCount: number;
  cacheRecallCount: number;
  lastRecallAt: string | null;
  lastTopScore: number | null;
}

export interface CodexMemoryRejectionReason {
  reason: string;
  count: number;
}

export interface CodexMemoryOverview {
  paths: CodexMemoryOverviewPaths;
  summary: CodexMemoryWriteSummary;
  rejectionReasons: CodexMemoryRejectionReason[];
  memoryLinks: CodexMemoryLink[];
  adaptive: {
    config: Record<string, unknown>;
    profiles: CodexMemoryAdaptiveProfile[];
    tagContribution: {
      flat: CodexMemoryTagContribution[];
    };
  };
  recall: {
    available: boolean;
    status: string;
    message: string;
    summary: CodexMemoryRecallSummary;
    recent: CodexMemoryRecallEntry[];
  };
}

export const codexMemoryApi = {
  async getOverview(
    params: { limit?: number; auditWindow?: number } = {},
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<CodexMemoryOverview> {
    const query = new URLSearchParams({
      limit: String(params.limit ?? 12),
      auditWindow: String(params.auditWindow ?? 500),
    });

    return requestWithUi<CodexMemoryOverview>(
      {
        url: `/admin_api/codex-memory/overview?${query.toString()}`,
      },
      uiOptions
    );
  },
};
