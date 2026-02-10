// ---- Frame envelope types (protocol v3) ----

export interface RequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

export interface ResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string };
}

export interface EventFrame {
  type: "event";
  seq?: number;
  event: string;
  payload?: unknown;
}

export type Frame = RequestFrame | ResponseFrame | EventFrame;

// ---- Connection handshake ----

export interface ClientInfo {
  id: string;
  version: string;
  platform: string;
  mode: string;
}

export interface DeviceAuthInfo {
  id: string;
  publicKey: string;
  signature: string;
  signedAt: number;
  nonce: string;
}

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: ClientInfo;
  role: string;
  scopes: string[];
  device?: DeviceAuthInfo;
  auth?: {
    token?: string;
    password?: string;
  };
  caps: string[];
}

export interface HelloOk {
  type?: string;
  protocol: number;
  server: {
    version: string;
    host?: string;
    connId?: string;
    id?: string;
    name?: string;
  };
  features?: {
    methods: string[];
    events: string[];
  };
  policy?: {
    maxPayload?: number;
    maxBufferedBytes?: number;
    tickIntervalMs?: number;
  };
  snapshot?: GatewaySnapshot;
  canvasHostUrl?: string;
  // Legacy fields (may or may not be present)
  tickIntervalMs?: number;
  session?: {
    id: string;
    scopes: string[];
    role: string;
  };
  device?: {
    token: string;
  };
}

// ---- Snapshot (received on connect) ----

export interface GatewaySnapshot {
  presence?: PresenceEntry[];
  health?: HealthInfo;
  stateVersion?: Record<string, number>;
  uptimeMs?: number;
  configPath?: string;
  stateDir?: string;
  sessionDefaults?: {
    defaultAgentId?: string;
    mainKey?: string;
    mainSessionKey?: string;
    scope?: string;
  };
  // May also include these from other gateway versions
  agents?: AgentSnapshotInfo[];
  sessions?: SessionInfo[];
  channels?: ChannelInfo[];
  approvals?: ApprovalRequest[];
  cron?: CronJob[];
}

// ---- Agent types ----

export interface AgentSnapshotInfo {
  agentId: string;
  isDefault?: boolean;
  heartbeat?: {
    enabled: boolean;
    every?: string;
    everyMs?: number;
    prompt?: string;
    target?: string;
    ackMaxChars?: number;
  };
  sessions?: {
    path?: string;
    count?: number;
    recent?: Array<{
      key: string;
      updatedAt: number;
      age: number;
    }>;
  };
  // Runtime state
  parentAgentId?: string;
  sessionId?: string;
  status?: string;
  model?: string;
  startedAt?: number;
  usage?: AgentUsage;
}

export interface AgentUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  cost?: number;
}

export interface AgentEventPayload {
  agentId: string;
  parentAgentId?: string;
  sessionId?: string;
  stream: "lifecycle" | "tool" | "assistant" | "user" | "error";
  event: string;
  data?: unknown;
  ts?: number;
}

// ---- Presence ----

export interface PresenceEntry {
  host: string;
  ip?: string;
  version?: string;
  platform?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  mode?: string;
  reason?: string;
  text?: string;
  ts?: number;
  roles?: string[];
  scopes?: string[];
  // Legacy fields
  clientId?: string;
  sessionId?: string;
  role?: string;
  client?: ClientInfo;
  connectedAt?: number;
  lastSeenAt?: number;
}

// ---- Health ----

export interface HealthChannelInfo {
  configured: boolean;
  tokenSource?: string;
  running: boolean;
  mode: string | null;
  lastStartAt: number | null;
  lastStopAt: number | null;
  lastError: string | null;
  probe?: {
    ok: boolean;
    status: string | null;
    error: string | null;
    elapsedMs?: number;
    bot?: {
      id: number;
      username: string;
      canJoinGroups?: boolean;
      canReadAllGroupMessages?: boolean;
      supportsInlineQueries?: boolean;
    };
  };
  lastProbeAt?: number;
  accountId?: string;
}

export interface HealthInfo {
  ok: boolean;
  ts?: number;
  durationMs?: number;
  channels?: Record<string, HealthChannelInfo>;
  channelOrder?: string[];
  channelLabels?: Record<string, string>;
  heartbeatSeconds?: number;
  defaultAgentId?: string;
  agents?: AgentSnapshotInfo[];
  sessions?: {
    path?: string;
    count?: number;
    recent?: Array<{ key: string; updatedAt: number; age: number }>;
  };
  // Legacy fields
  status?: "ok" | "degraded" | "error";
  uptime?: number;
  version?: string;
  memory?: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
}

// ---- Sessions ----

export interface SessionInfo {
  id?: string;
  key?: string;
  name?: string;
  createdAt?: number;
  updatedAt?: number;
  lastActiveAt?: number;
  agentCount?: number;
  status?: string;
  age?: number;
}

// ---- Channels ----

export interface ChannelInfo {
  id: string;
  name: string;
  type?: string;
  status?: "active" | "idle" | "error";
  configured?: boolean;
  running?: boolean;
  connectedAt?: number;
  messageCount?: number;
  lastMessageAt?: number;
}

// ---- Approvals ----

export interface ApprovalRequest {
  id: string;
  agentId: string;
  sessionId?: string;
  type: string;
  command?: string;
  args?: string[];
  cwd?: string;
  description?: string;
  requestedAt: number;
  expiresAt?: number;
  status: "pending" | "approved" | "denied" | "expired";
  resolvedBy?: string;
  resolvedAt?: number;
}

// ---- Cron ----

export interface CronSchedule {
  kind: "at" | "every" | "cron";
  at?: string;
  everyMs?: number;
  expr?: string;
  tz?: string;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: CronSchedule | string;
  enabled: boolean;
  agentId?: string;
  description?: string;
  deleteAfterRun?: boolean;
  sessionTarget?: string;
  wakeMode?: string;
  payload?: unknown;
  delivery?: unknown;
  lastRun?: number;
  nextRun?: number;
  status?: "idle" | "running" | "error";
  lastError?: string;
}

export interface CronRunLog {
  jobId: string;
  runId: string;
  startedAt: number;
  finishedAt?: number;
  status: "running" | "success" | "error";
  error?: string;
}

// ---- Chat ----

/** Chat event payload from the gateway (event: "chat") */
export interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: {
    role: "assistant";
    content: Array<{ type: string; text: string }>;
    timestamp?: number;
    stopReason?: string;
  };
  errorMessage?: string;
  usage?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    totalCost: number;
    inputCost?: number;
    outputCost?: number;
    cacheReadCost?: number;
    cacheWriteCost?: number;
  };
}

/** Chat history message from chat.history RPC response */
export interface ChatHistoryMessage {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: string; text?: string }>;
  timestamp?: number;
  ts?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  agentId?: string;
  sessionId?: string;
  ts: number;
  streaming?: boolean;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  args?: unknown;
  status: "pending" | "running" | "completed" | "error";
  result?: unknown;
  startedAt?: number;
  completedAt?: number;
}

// ---- Log entries ----

export interface LogEntry {
  ts: number;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  source?: string;
  data?: unknown;
}

// ---- Usage / metrics ----

export interface UsageMetrics {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalCost: number;
  byModel: Record<string, ModelUsage>;
  bySession: Record<string, SessionUsage>;
  byAgent: Record<string, Record<string, ModelUsage>>;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface SessionUsage {
  inputTokens: number;
  outputTokens: number;
  cost: number;
}
