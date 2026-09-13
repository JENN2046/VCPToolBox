import { reactive, ref } from "vue";

export const ACK_WAIT_MS = 10000;
export const SYNC_WAIT_MS = 10000;
const MAX_CLOCK_OFFSET_MS = 86400000;
export type HostTerminal = "ALLOWED" | "DENIED" | "EXPIRED" | "CANCELLED";
export interface SubmittedDecision {
  readonly requestId: string;
  readonly generation: number;
  readonly decisionEpoch: number;
  readonly decision: "ALLOW" | "DENY";
}
export type ApprovalState = "ACTIVE" | "SENDING" | "DELIVERY_UNKNOWN" | "ACCEPTED" | "DENIED" |
  "TERMINAL_OTHER_CLIENT" | "EXPIRED" | "CANCELLED" | "STALE_UNKNOWN" | "LOCAL_DEADLINE_REACHED" | "ACTIVE_RETRY_REQUIRES_RECONNECT" | "ERROR";
export interface AuthorityTarget {
  operation: string;
  fields: { label: string; value: string }[];
  valid: boolean;
}
export interface ApprovalRecord {
  requestId: string;
  toolName: string;
  maid?: string;
  timestamp?: string;
  args: Record<string, unknown>;
  argsDigest?: string;
  createdAt?: number;
  expiresAt?: number;
  authorityTarget?: AuthorityTarget;
  changePreview?: { target: string; replace: string };
  state: ApprovalState;
  hostTerminal?: HostTerminal;
  clientSurface?: string;
  localDecisionAccepted: boolean;
  attemptedDecision?: SubmittedDecision;
  acceptedSubmittedDecision?: SubmittedDecision;
  error?: string;
}
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const id = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 200;
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0;
const terminal = (x: unknown): x is HostTerminal => ["ALLOWED", "DENIED", "EXPIRED", "CANCELLED"].includes(String(x));
function freeze<T>(x: T): T {
  if (x && typeof x === "object") { Object.values(x).forEach(freeze); Object.freeze(x); }
  return x;
}
export function authorityTarget(toolName: unknown, args: Record<string, unknown>): AuthorityTarget | undefined {
  if (toolName !== "CodexWorker" || !["grant", "revoke"].includes(String(args.command))) return undefined;
  const text = (x: unknown): x is string => typeof x === "string" && !!x.trim();
  return freeze(args.command === "grant" ? {
    operation: "授予一次性提案写入权限",
    fields: [{ label: "项目根目录（projectRoot）", value: text(args.projectRoot) ? args.projectRoot : "" },
      { label: "用途（purpose）", value: text(args.purpose) ? args.purpose : "" }],
    valid: text(args.projectRoot) && args.purpose === "propose",
  } : {
    operation: "撤销一次性提案写入权限",
    fields: [{ label: "授权 ID（grantId）", value: text(args.grantId) ? args.grantId : "" }],
    valid: text(args.grantId),
  });
}
export function approvalMessage(r: ApprovalRecord): string {
  if (r.error === "PROTOCOL_STATE_CONFLICT") return "审批协议状态冲突，操作已禁用。";
  if (r.hostTerminal) {
    const result = { ALLOWED: "允许", DENIED: "拒绝", EXPIRED: "已过期", CANCELLED: "已取消" }[r.hostTerminal];
    if (r.localDecisionAccepted) return `审批决定已被服务器接受（${result}）。下游执行结果另行返回。`;
    const source = ["vcp_chat", "vcp_mobile"].includes(r.clientSurface || "") ? "已在另一可信客户端完成审批" :
      r.clientSurface === "admin_panel" ? "已由某个可信 Admin 会话完成审批" : "Host 已完成审批";
    return `${source}：${result}。`;
  }
  const messages: Record<ApprovalState, string> = {
    ACTIVE: "等待人工审批", SENDING: "正在提交审批…", DELIVERY_UNKNOWN: "审批投递结果未知，等待服务器同步；不会自动重发。",
    ACTIVE_RETRY_REQUIRES_RECONNECT: "请求仍有效；需重新建立可信审批连接并同步后才能再次提交。",
    ACCEPTED: "审批决定已被服务器接受，等待终态。", DENIED: "Host 已拒绝审批。", TERMINAL_OTHER_CLIENT: "Host 已完成审批。",
    EXPIRED: "Host 确认审批已过期。", CANCELLED: "Host 已取消审批。", STALE_UNKNOWN: "服务器未找到此审批，操作已禁用。",
    LOCAL_DEADLINE_REACHED: "已到本地显示期限，等待 Host 确认。", ERROR: "审批未获确认，操作已禁用。",
  };
  const errors: Record<string, string> = {
    CLIENT_NOT_AUTHORIZED: "当前审批会话未获授权。", INVALID_RESPONSE: "审批协议消息无效。",
    TARGET_MISMATCH: "审批目标不匹配。", INTERNAL_ERROR: "Host 未能完成审批接纳。", SYNC_TIMEOUT: "同步等待超时，请重新连接。",
    CLOCK_UNVERIFIED: "无法确认服务器时间，审批操作已禁用。", CAPACITY: "审批记录容量已达上限，请重新同步。",
  };
  return r.error ? errors[r.error] || messages.ERROR : messages[r.state];
}

// Local presentation state only. No capability, credentials or authority digest generation.
export function createApprovalProtocol(send: (type: string, data: unknown) => boolean) {
  const records = reactive(new Map<string, ApprovalRecord>());
  const ready = ref(false);
  const needsReconnect = ref(false);
  const connectionGeneration = ref(0);
  const clockOffset = ref<number | null>(null);
  const attempts = new Map<string, { identity: SubmittedDecision; until: number }>();
  // Host v1 cannot echo a send epoch. A request may have only one submitted decision
  // per socket generation. Keep its identity for late ACKs, separately from ACK waiting.
  const sentDecisions = new Map<string, SubmittedDecision>();
  const retryQuarantine = new Set<string>();
  const signatures = new Map<string, string>();
  let connected = false, syncAt: number | null = null;
  let decisionEpoch = 0;
  let capacityFault = false;
  let anchor: { host: number; mono: number } | null = null;
  let ticker: ReturnType<typeof setInterval> | undefined;
  const mono = () => performance.now();
  const hostNow = () => anchor ? anchor.host + Math.max(0, mono() - anchor.mono) : null;
  function fail(r: ApprovalRecord, code: string) {
    r.state = "ERROR";
    if (r.error !== "PROTOCOL_STATE_CONFLICT") r.error = code;
    attempts.delete(r.requestId);
  }
  function protocolError(data?: Record<string, unknown>) {
    const r = id(data?.requestId) ? records.get(data.requestId) : undefined;
    if (r) fail(r, "INVALID_RESPONSE");
    else { ready.value = false; for (const item of records.values()) if (!item.hostTerminal) fail(item, "INVALID_RESPONSE"); }
  }
  function validTarget(data: Record<string, unknown>): boolean {
    return id(data.requestId) && typeof data.toolName === "string" && !!data.toolName && object(data.args) &&
      data.protocolVersion === 1 && finite(data.createdAt) && finite(data.expiresAt) && data.expiresAt > data.createdAt &&
      data.expiresAt - data.createdAt <= 86400000 && typeof data.argsDigest === "string" && /^[a-f0-9]{64}$/.test(data.argsDigest);
  }
  function updateDeadline(r: ApprovalRecord) {
    const now = hostNow();
    if (!r.hostTerminal && r.state === "ACTIVE" && now !== null && r.expiresAt !== undefined && now >= r.expiresAt)
      r.state = "LOCAL_DEADLINE_REACHED";
  }
  function upsert(data: Record<string, unknown>, fromSync = false): ApprovalRecord | undefined {
    if (!validTarget(data)) { protocolError(data); return undefined; }
    const key = data.requestId as string;
    let r = records.get(key);
    if (r?.hostTerminal || r?.error === "PROTOCOL_STATE_CONFLICT") {
      if (fromSync && r.hostTerminal) fail(r, "PROTOCOL_STATE_CONFLICT");
      return r;
    }
    const args = freeze(JSON.parse(JSON.stringify(data.args)) as Record<string, unknown>);
    const signature = JSON.stringify([key, data.toolName, args, data.argsDigest, data.createdAt, data.expiresAt]);
    if (r && !fromSync && signatures.get(key) !== signature) { fail(r, "TARGET_MISMATCH"); return r; }
    if (r && !fromSync) return r;
    if (r?.localDecisionAccepted && fromSync) { fail(r, "INVALID_RESPONSE"); return r; }
    if (!r && records.size >= 1280) { capacityFault = true; ready.value = false; for (const entry of records.values()) if (!entry.hostTerminal) fail(entry, "CAPACITY"); return undefined; } // Never evict authority memory into an actionable stale card.
    const target = authorityTarget(data.toolName, args);
    const preview = object(data.changePreview) && typeof data.changePreview.target === "string" && typeof data.changePreview.replace === "string"
      ? freeze({ target: data.changePreview.target, replace: data.changePreview.replace }) : undefined;
    const fields = { requestId: key, toolName: data.toolName as string, args, argsDigest: data.argsDigest as string,
      createdAt: data.createdAt as number, expiresAt: data.expiresAt as number, authorityTarget: target, changePreview: preview,
      maid: typeof data.maid === "string" ? data.maid : r?.maid, timestamp: typeof data.timestamp === "string" ? data.timestamp : r?.timestamp, state: "ACTIVE" as ApprovalState, error: undefined, localDecisionAccepted: false };
    if (r) Object.assign(r, fields); else { records.set(key, fields); r = records.get(key)!; }
    signatures.set(key, signature);
    if (fromSync) {
      attempts.delete(key);
      if (sentDecisions.has(key)) {
        retryQuarantine.add(key);
        r.state = "ACTIVE_RETRY_REQUIRES_RECONNECT";
      }
    }
    updateDeadline(r); return r;
  }
  function absorbTerminal(data: Record<string, unknown>): void {
    const key = data.requestId as string;
    let r = records.get(key);
    if (!r) {
      if (records.size >= 1280) { capacityFault = true; ready.value = false; for (const entry of records.values()) if (!entry.hostTerminal) fail(entry, "CAPACITY"); return; }
      records.set(key, { requestId: key, toolName: "", args: freeze({}), state: "STALE_UNKNOWN", localDecisionAccepted: false });
      r = records.get(key)!;
    }
    if (r.error === "PROTOCOL_STATE_CONFLICT") return;
    if (r.hostTerminal && r.hostTerminal !== data.terminalState) { fail(r, "PROTOCOL_STATE_CONFLICT"); return; }
    r.hostTerminal = data.terminalState as HostTerminal;
    if (typeof data.clientSurface === "string") r.clientSurface = data.clientSurface;
    // ACK evidence outlives the send timer, sync epochs and connection replacement.
    // Retain the actual Host terminal on conflict; never substitute the local choice.
    const accepted = r.acceptedSubmittedDecision;
    if (accepted && r.hostTerminal !== (accepted.decision === "ALLOW" ? "ALLOWED" : "DENIED")) {
      fail(r, "PROTOCOL_STATE_CONFLICT"); return;
    }
    r.error = undefined;
    r.state = r.hostTerminal === "EXPIRED" ? "EXPIRED" : r.hostTerminal === "CANCELLED" ? "CANCELLED" :
      r.localDecisionAccepted ? (r.hostTerminal === "ALLOWED" ? "ACCEPTED" : "DENIED") : "TERMINAL_OTHER_CLIENT";
  }
  function sync() {
    if (!connected || syncAt !== null || needsReconnect.value) return;
    ready.value = false; syncAt = mono();
    if (!send("tool_approval_sync", { protocolVersion: 1 })) { syncAt = null; needsReconnect.value = true; }
  }
  function tick() {
    for (const r of records.values()) updateDeadline(r);
    for (const [key, attempt] of attempts) if (mono() >= attempt.until) {
      attempts.delete(key); const r = records.get(key)!;
      retryQuarantine.add(key);
      if (!r.hostTerminal) { r.state = "DELIVERY_UNKNOWN"; sync(); }
    }
    if (syncAt !== null && mono() - syncAt >= SYNC_WAIT_MS) {
      syncAt = null; ready.value = false; needsReconnect.value = true;
      for (const r of records.values()) if (!r.hostTerminal && r.state !== "DELIVERY_UNKNOWN") fail(r, "SYNC_TIMEOUT");
    }
  }
  function ingest(type: string, input: unknown, generation: number): void {
    // Each listener belongs to one exact WebSocket. Old terminals are safely recoverable by the new sync.
    if (!connected || generation !== connectionGeneration.value) return;
    if (!object(input)) { protocolError(); return; }
    const data = input;
    if (type === "tool_approval_request") { upsert(data); return; }
    if (data.protocolVersion !== 1) { protocolError(data); return; }
    if (type === "tool_approval_snapshot") {
      if (syncAt === null || needsReconnect.value) return; // No unsolicited / late snapshot may reset a newer sending epoch.
      if (data.outcome !== "SYNCED" || !finite(data.serverTime) || !Array.isArray(data.active) || !Array.isArray(data.terminal) ||
          data.active.length > 256 || data.terminal.length > 1024) { protocolError(); syncAt = null; needsReconnect.value = true; return; }
      const all = [...data.active, ...data.terminal];
      if (all.some(x => !object(x) || !id(x.requestId)) || new Set(all.map(x => x.requestId)).size !== all.length ||
          data.active.some(x => !validTarget({ ...x, protocolVersion: 1 }) || x.state !== "PENDING") ||
          data.terminal.some(x => !terminal(x.terminalState) || !finite(x.terminalAt))) { protocolError(); syncAt = null; needsReconnect.value = true; return; }
      const received = mono(), elapsed = Math.max(0, received - syncAt);
      syncAt = null; attempts.clear();
      if (elapsed > SYNC_WAIT_MS || Math.abs(data.serverTime - Date.now()) > MAX_CLOCK_OFFSET_MS) {
        ready.value = false; needsReconnect.value = true; for (const r of records.values()) if (!r.hostTerminal) fail(r, "CLOCK_UNVERIFIED"); return;
      }
      // Count the entire round trip conservatively as server-time advance; never subtract network delay.
      anchor = { host: data.serverTime + elapsed, mono: received }; clockOffset.value = anchor.host - Date.now();
      const seen = new Set(all.map(x => x.requestId));
      for (const r of records.values()) if (!seen.has(r.requestId) && !r.hostTerminal && r.error !== "PROTOCOL_STATE_CONFLICT") {
        r.state = "STALE_UNKNOWN"; r.error = undefined;
      }
      for (const t of data.terminal) absorbTerminal(t);
      for (const active of data.active) upsert({ ...active, protocolVersion: 1 }, true);
      const retryNeedsRotation = [...records.values()].some(r => r.state === "ACTIVE_RETRY_REQUIRES_RECONNECT");
      if (retryNeedsRotation) needsReconnect.value = true;
      ready.value = !capacityFault && !retryNeedsRotation; return;
    }
    if (!id(data.requestId)) { protocolError(); return; }
    if (type === "tool_approval_terminal") {
      if (!terminal(data.terminalState) || !finite(data.terminalAt) || (data.clientSurface !== undefined && !["admin_panel", "vcp_chat", "vcp_mobile"].includes(String(data.clientSurface)))) { protocolError(data); return; }
      absorbTerminal(data); return;
    }
    if (type !== "tool_approval_ack") return;
    const r = records.get(data.requestId); if (!r) return;
    const outcomes = ["ACCEPTED", "ALREADY_TERMINAL", "REQUEST_EXPIRED", "REQUEST_UNKNOWN", "CLIENT_NOT_AUTHORIZED", "INVALID_RESPONSE", "TARGET_MISMATCH", "INTERNAL_ERROR"];
    if (!outcomes.includes(String(data.outcome)) || (data.terminalState !== null && !terminal(data.terminalState))) { protocolError(data); return; }
    const allowedTerminal: Record<string, (string | null)[]> = {
      ACCEPTED: [null, "ALLOWED", "DENIED"], ALREADY_TERMINAL: ["ALLOWED", "DENIED", "CANCELLED"], REQUEST_EXPIRED: ["EXPIRED"],
      REQUEST_UNKNOWN: [null], CLIENT_NOT_AUTHORIZED: [null], INVALID_RESPONSE: [null], TARGET_MISMATCH: [null], INTERNAL_ERROR: ["CANCELLED"],
    };
    if (!allowedTerminal[String(data.outcome)]?.includes(data.terminalState as string | null) ||
        (terminal(data.terminalState) && !finite(data.terminalAt))) { protocolError(data); return; }
    if (r.error === "PROTOCOL_STATE_CONFLICT") return;
    const identity = sentDecisions.get(r.requestId);
    // An ACK after the wait deadline still describes the sole decision on this pair.
    // Local decisionEpoch is diagnostic, not a field authenticated by the Host ACK.
    const own = identity && identity.requestId === r.requestId && identity.generation === generation;
    if (data.outcome === "ACCEPTED" && own) {
      r.acceptedSubmittedDecision = identity;
      r.localDecisionAccepted = true;
      if (!data.terminalState && !r.hostTerminal) r.state = "ACCEPTED";
    }
    if (terminal(data.terminalState)) absorbTerminal(data);
    else if (r.hostTerminal && r.localDecisionAccepted) absorbTerminal({ requestId: r.requestId, terminalState: r.hostTerminal });
    if (own) attempts.delete(r.requestId);
    if (r.error === "PROTOCOL_STATE_CONFLICT") return;
    if (r.hostTerminal) return;
    if (data.outcome === "ACCEPTED") { sync(); return; }
    if (data.outcome === "REQUEST_UNKNOWN") { r.state = "STALE_UNKNOWN"; return; }
    if (data.outcome === "REQUEST_EXPIRED") { r.state = "LOCAL_DEADLINE_REACHED"; sync(); return; }
    if (data.outcome === "ALREADY_TERMINAL") { r.state = "DELIVERY_UNKNOWN"; sync(); return; }
    fail(r, String(data.outcome));
  }
  function canRespond(r: ApprovalRecord | undefined, approved: boolean) {
    if (!r) return false; updateDeadline(r);
    const signature = JSON.stringify([r.requestId, r.toolName, r.args, r.argsDigest, r.createdAt, r.expiresAt]);
    const consistent = records.get(r.requestId) === r && signatures.get(r.requestId) === signature && JSON.stringify(r.authorityTarget) === JSON.stringify(authorityTarget(r.toolName, r.args));
    return connected && ready.value && r.state === "ACTIVE" && !r.hostTerminal && !sentDecisions.has(r.requestId) && !retryQuarantine.has(r.requestId) && consistent && (!approved || r.authorityTarget?.valid !== false);
  }
  function respond(key: string, approved: boolean, reason?: string): boolean {
    const r = records.get(key);
    if (!r || !canRespond(r, approved) || typeof approved !== "boolean") return false;
    if (reason !== undefined && (typeof reason !== "string" || reason.length > 1000)) { fail(r, "INVALID_RESPONSE"); return false; }
    r.state = "SENDING"; r.error = undefined; r.localDecisionAccepted = false;
    const identity: SubmittedDecision = Object.freeze({ requestId: key, generation: connectionGeneration.value,
      decisionEpoch: ++decisionEpoch, decision: approved ? "ALLOW" : "DENY" });
    r.attemptedDecision = identity;
    r.acceptedSubmittedDecision = undefined;
    sentDecisions.set(key, identity);
    attempts.set(key, { identity, until: mono() + ACK_WAIT_MS });
    const sent = send("tool_approval_response", { requestId: key, approved, protocolVersion: 1, argsDigest: r.argsDigest, ...(reason?.trim() ? { reason: reason.trim() } : {}) });
    if (!sent) { attempts.delete(key); retryQuarantine.add(key); r.state = "DELIVERY_UNKNOWN"; sync(); }
    return sent;
  }
  function disconnected(generation: number) {
    if (generation !== connectionGeneration.value) return;
    connected = false; ready.value = false; syncAt = null; anchor = null; clockOffset.value = null;
    attempts.clear(); for (const r of records.values()) if (r.state === "SENDING") { retryQuarantine.add(r.requestId); r.state = "DELIVERY_UNKNOWN"; }
    clearInterval(ticker); ticker = undefined;
  }
  function onConnected(generation: number) {
    if (!Number.isSafeInteger(generation) || generation <= connectionGeneration.value) return;
    disconnected(connectionGeneration.value); connectionGeneration.value = generation; connected = true; needsReconnect.value = false;
    sentDecisions.clear(); retryQuarantine.clear();
    ticker = setInterval(tick, 250); sync();
  }
  return { records, ready, needsReconnect, connectionGeneration, clockOffset, ingest, respond, canRespond, sync, connected: onConnected, disconnected };
}
