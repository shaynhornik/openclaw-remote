import { useState, useEffect, useCallback, useRef } from "react";
import { useAgentsStore } from "@/stores/agents";
import { useConnectionStore } from "@/stores/connection";
import { useRequest } from "@/hooks/useRequest";
import { CodeEditor } from "@/components/shared/CodeEditor";

// ── Types ──────────────────────────────────────────────────────────

interface ConfigGetResponse {
  raw: string;
  hash: string;
  redacted?: boolean;
}

interface ModelInfo {
  id: string;
  name?: string;
  provider?: string;
}

interface ModelsListResponse {
  models: ModelInfo[];
}

interface FallbackEntry {
  id: string;
  model: string;
}

interface AgentDefaults {
  heartbeatEnabled: boolean;
  heartbeatIntervalMs: number;
  heartbeatPrompt: string;
}

interface ChannelConfig {
  id: string;
  mode: string;
  enabled: boolean;
  token: string;
  extra: Record<string, unknown>;
}

interface ServerConfig {
  port: number;
  host: string;
  authMethod: string;
}

interface ParsedConfig {
  defaultModel: string;
  fallbackOrder: FallbackEntry[];
  agentModels: Record<string, string>;
  agentDefaults: Record<string, AgentDefaults>;
  channels: ChannelConfig[];
  server: ServerConfig;
  unknownSections: Record<string, unknown>;
  raw: Record<string, unknown>;
}

// ── Config parsing ─────────────────────────────────────────────────

let nextFbId = 1;

function emptyParsedConfig(): ParsedConfig {
  return {
    defaultModel: "",
    fallbackOrder: [],
    agentModels: {},
    agentDefaults: {},
    channels: [],
    server: { port: 18789, host: "", authMethod: "none" },
    unknownSections: {},
    raw: {},
  };
}

/** Ensure a value is a non-null object, or return undefined. */
function asObj(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

function parseConfig(rawStr: string): ParsedConfig {
  let raw: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(rawStr);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      raw = parsed as Record<string, unknown>;
    }
  } catch {
    // not valid JSON — return defaults
    return emptyParsedConfig();
  }

  const result = emptyParsedConfig();
  result.raw = raw;

  // ── Default model — check multiple paths ──
  try {
    const agentsCfg = asObj(raw.agents);
    const agentCfg = asObj(raw.agent);
    const defaultsCfg = asObj(agentsCfg?.defaults) ?? asObj(agentCfg?.defaults) ?? asObj(raw.defaults);

    result.defaultModel = typeof defaultsCfg?.model === "string" ? defaultsCfg.model : "";

    // Fallback order
    const fbRaw = defaultsCfg?.modelFallback ?? defaultsCfg?.modelTryOrder;
    if (Array.isArray(fbRaw)) {
      result.fallbackOrder = fbRaw.map((m) => ({ id: String(nextFbId++), model: String(m) }));
    }
  } catch {
    // ignore parse errors for this section
  }

  // ── Per-agent model overrides + agent defaults ──
  try {
    const agentsCfg = asObj(raw.agents);
    const agentCfg = asObj(raw.agent);
    const agentDefsSection = asObj(agentsCfg?.agents) ?? asObj(agentCfg?.agents);

    if (agentDefsSection) {
      for (const [id, def] of Object.entries(agentDefsSection)) {
        const d = asObj(def);
        if (!d) continue; // skip null/string/number agent entries

        if (typeof d.model === "string") {
          result.agentModels[id] = d.model;
        }

        const hb = asObj(d.heartbeat);
        result.agentDefaults[id] = {
          heartbeatEnabled: hb ? Boolean(hb.enabled) : false,
          heartbeatIntervalMs: typeof hb?.intervalMs === "number"
            ? hb.intervalMs
            : typeof hb?.interval === "number"
              ? hb.interval
              : 300000,
          heartbeatPrompt: typeof hb?.prompt === "string" ? hb.prompt : "",
        };
      }
    }
  } catch {
    // ignore parse errors for this section
  }

  // ── Channels ──
  try {
    const channelsCfg = asObj(raw.channels);
    if (channelsCfg) {
      for (const [id, cfg] of Object.entries(channelsCfg)) {
        const c = asObj(cfg);
        if (!c) continue; // skip null/primitive channel entries

        result.channels.push({
          id,
          mode: typeof c.mode === "string" ? c.mode : "polling",
          enabled: c.enabled !== false,
          token: typeof c.token === "string" ? c.token : "",
          extra: Object.fromEntries(
            Object.entries(c).filter(([k]) => !["mode", "enabled", "token"].includes(k)),
          ),
        });
      }
    }
  } catch {
    // ignore parse errors for this section
  }

  // ── Server ──
  try {
    const serverCfg = asObj(raw.server);
    if (serverCfg) {
      result.server = {
        port: typeof serverCfg.port === "number" ? serverCfg.port : 18789,
        host: typeof serverCfg.host === "string" ? serverCfg.host : "",
        authMethod: typeof serverCfg.authMethod === "string"
          ? serverCfg.authMethod
          : typeof serverCfg.auth === "string"
            ? serverCfg.auth
            : "none",
      };
    }
  } catch {
    // ignore
  }

  // ── Unknown sections ──
  const knownKeys = new Set(["agents", "agent", "defaults", "channels", "server"]);
  for (const [key, value] of Object.entries(raw)) {
    if (!knownKeys.has(key)) {
      result.unknownSections[key] = value;
    }
  }

  return result;
}

function mergeConfig(
  original: Record<string, unknown>,
  parsed: ParsedConfig,
): Record<string, unknown> {
  const result = structuredClone(original);

  // Ensure agents.defaults exists
  if (!result.agents || typeof result.agents !== "object") {
    result.agents = {};
  }
  const agentsObj = result.agents as Record<string, unknown>;
  if (!agentsObj.defaults || typeof agentsObj.defaults !== "object") {
    agentsObj.defaults = {};
  }
  const defaults = agentsObj.defaults as Record<string, unknown>;

  // Default model
  if (parsed.defaultModel) {
    defaults.model = parsed.defaultModel;
  } else {
    delete defaults.model;
  }

  // Fallback order
  if (parsed.fallbackOrder.length > 0) {
    defaults.modelFallback = parsed.fallbackOrder.map((f) => f.model);
  } else {
    delete defaults.modelFallback;
  }

  // Per-agent overrides
  if (!agentsObj.agents || typeof agentsObj.agents !== "object") {
    agentsObj.agents = {};
  }
  const agentSection = agentsObj.agents as Record<string, unknown>;

  for (const [id, model] of Object.entries(parsed.agentModels)) {
    if (!agentSection[id] || typeof agentSection[id] !== "object") {
      agentSection[id] = {};
    }
    if (model) {
      (agentSection[id] as Record<string, unknown>).model = model;
    } else {
      delete (agentSection[id] as Record<string, unknown>).model;
    }
  }

  // Agent defaults (heartbeat)
  for (const [id, def] of Object.entries(parsed.agentDefaults)) {
    if (!agentSection[id] || typeof agentSection[id] !== "object") {
      agentSection[id] = {};
    }
    const agentObj = agentSection[id] as Record<string, unknown>;
    if (def.heartbeatEnabled || def.heartbeatPrompt) {
      agentObj.heartbeat = {
        enabled: def.heartbeatEnabled,
        intervalMs: def.heartbeatIntervalMs,
        ...(def.heartbeatPrompt ? { prompt: def.heartbeatPrompt } : {}),
      };
    }
  }

  // Channels
  if (parsed.channels.length > 0) {
    const channelsObj: Record<string, unknown> = {};
    for (const ch of parsed.channels) {
      channelsObj[ch.id] = {
        mode: ch.mode,
        enabled: ch.enabled,
        ...(ch.token ? { token: ch.token } : {}),
        ...ch.extra,
      };
    }
    result.channels = channelsObj;
  }

  // Server
  result.server = {
    ...(asObj(result.server) ?? {}),
    port: parsed.server.port,
    host: parsed.server.host,
    authMethod: parsed.server.authMethod,
  };

  return result;
}

// ── Ensure a value is always a string for CodeMirror ───────────────

function ensureString(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

// ── Component ──────────────────────────────────────────────────────

export function ConfigView() {
  const agents = useAgentsStore((s) => s.agentsList);
  const status = useConnectionStore((s) => s.status);

  // Models
  const [models, setModels] = useState<ModelInfo[]>([]);

  // Parsed config form state
  const [form, setForm] = useState<ParsedConfig | null>(null);
  const [redacted, setRedacted] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  // Raw config state
  const [rawConfig, setRawConfig] = useState("");
  const [editConfig, setEditConfig] = useState("");
  const [baseHash, setBaseHash] = useState("");
  const [rawExpanded, setRawExpanded] = useState(false);
  const [rawEditing, setRawEditing] = useState(false);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rawSaving, setRawSaving] = useState(false);
  const [rawSaved, setRawSaved] = useState(false);
  const [rawError, setRawError] = useState<string | null>(null);

  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["models"]),
  );

  // Channel token visibility
  const [revealedTokens, setRevealedTokens] = useState<Set<string>>(new Set());

  const configReq = useRequest<ConfigGetResponse>();
  const modelsReq = useRequest<ModelsListResponse>();
  const patchReq = useRequest<unknown>();

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  // ── Apply config result to state ─────────────────────────────

  const applyConfigResult = useCallback((configResult: unknown) => {
    if (configResult == null) return;
    const r = typeof configResult === "object" ? configResult as Record<string, unknown> : null;
    const raw = ensureString(
      typeof configResult === "string" ? configResult : r?.raw,
    );
    const hash = typeof r?.hash === "string" ? r.hash : "";
    setRawConfig(raw);
    setEditConfig(raw);
    setBaseHash(hash);
    setRedacted(r ? Boolean(r.redacted) : false);
    setForm(parseConfig(raw));
  }, []);

  // ── Fetch config + models ────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setFetchError(null);
    const [configResult, modelsResult] = await Promise.all([
      configReq.execute("config.get"),
      modelsReq.execute("models.list"),
    ]);

    if (configResult != null) {
      applyConfigResult(configResult);
    } else {
      // config.get failed — still show the form with defaults so the page isn't empty
      setForm(emptyParsedConfig());
      setFetchError(configReq.error ?? "Failed to load configuration");
    }

    if (modelsResult != null) {
      if (Array.isArray(modelsResult)) {
        setModels(
          (modelsResult as unknown[]).map((m) =>
            typeof m === "string" ? { id: m } : (m as ModelInfo),
          ),
        );
      } else if (modelsResult.models) {
        setModels(
          modelsResult.models.map((m) =>
            typeof m === "string" ? { id: m as unknown as string } : m,
          ),
        );
      }
    }

    fetchedRef.current = true;
  }, [applyConfigResult]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status === "connected") {
      fetchedRef.current = false;
      fetchAll();
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Form updates ─────────────────────────────────────────────

  const updateForm = useCallback((updater: (prev: ParsedConfig) => ParsedConfig) => {
    setForm((prev) => {
      if (!prev) return prev;
      return updater(prev);
    });
    setSaved(false);
  }, []);

  // ── Save config (structured form) ────────────────────────────

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const merged = mergeConfig(form.raw, form);
    const raw = JSON.stringify(merged, null, 2);

    const result = await patchReq.execute("config.patch", { raw, baseHash });
    setSaving(false);

    if (result != null) {
      setSaved(true);
      const refreshed = await configReq.execute("config.get");
      if (refreshed != null) applyConfigResult(refreshed);
    } else if (patchReq.error) {
      setSaveError(
        isConflictError(patchReq.error)
          ? "Config was modified elsewhere. Please re-fetch before saving."
          : patchReq.error,
      );
    }
  };

  // ── Save raw config ──────────────────────────────────────────

  const handleRawSave = async () => {
    setRawSaving(true);
    setRawError(null);
    setRawSaved(false);

    const result = await patchReq.execute("config.patch", {
      raw: editConfig,
      baseHash,
    });

    setRawSaving(false);
    if (result != null) {
      setRawConfig(editConfig);
      setRawEditing(false);
      setRawSaved(true);
      const refreshed = await configReq.execute("config.get");
      if (refreshed != null) applyConfigResult(refreshed);
    } else if (patchReq.error) {
      setRawError(
        isConflictError(patchReq.error)
          ? "Config was modified elsewhere. Please re-fetch before saving."
          : patchReq.error,
      );
    }
  };

  const handleRawCancel = () => {
    setEditConfig(rawConfig);
    setRawEditing(false);
    setRawError(null);
  };

  const handleRawRefetch = async () => {
    setRawError(null);
    setSaveError(null);
    setFetchError(null);
    const result = await configReq.execute("config.get");
    if (result != null) {
      applyConfigResult(result);
    }
  };

  // ── Render ───────────────────────────────────────────────────

  if (status !== "connected") {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Connect to gateway to view configuration
      </div>
    );
  }

  // Show loading until we've attempted to fetch
  if (!fetchedRef.current && !form) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        Loading configuration...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Warning banner */}
      <div className="flex items-start gap-2 rounded-md bg-yellow-900/30 border border-yellow-800/50 px-3 py-2">
        <span className="text-yellow-500 text-sm mt-0.5">!</span>
        <p className="text-xs text-yellow-400">
          Saving configuration changes triggers a gateway restart.
        </p>
      </div>

      {/* Fetch error */}
      {fetchError && (
        <div className="rounded-md bg-red-900/30 border border-red-800/50 px-3 py-2 text-sm text-red-400">
          {fetchError}
          <button onClick={handleRawRefetch} className="ml-2 underline hover:text-red-300">
            Retry
          </button>
        </div>
      )}

      {/* Section A: Models */}
      <CollapsibleSection
        title="Models"
        sectionId="models"
        expanded={expandedSections.has("models")}
        onToggle={() => toggleSection("models")}
      >
        {form && (
          <div className="space-y-4">
            {/* Default model */}
            <div className="space-y-2">
              <label htmlFor="default-model" className="block text-sm font-medium text-slate-300">
                Default Model
              </label>
              <ModelSelect
                id="default-model"
                value={form.defaultModel}
                models={models}
                onChange={(v) => updateForm((f) => ({ ...f, defaultModel: v }))}
                placeholder="Not set"
              />
            </div>

            {/* Fallback order */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Model Fallback Order
              </label>
              <p className="text-xs text-slate-500">
                Models tried in order when the primary fails.
              </p>
              <div className="space-y-2">
                {form.fallbackOrder.map((entry, i) => (
                  <div key={entry.id} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-5 text-right shrink-0">
                      {i + 1}.
                    </span>
                    <ModelSelect
                      value={entry.model}
                      models={models}
                      onChange={(v) =>
                        updateForm((f) => ({
                          ...f,
                          fallbackOrder: f.fallbackOrder.map((e) =>
                            e.id === entry.id ? { ...e, model: v } : e,
                          ),
                        }))
                      }
                      placeholder="Select model"
                      className="flex-1"
                    />
                    <button
                      onClick={() =>
                        updateForm((f) => ({
                          ...f,
                          fallbackOrder: moveItem(f.fallbackOrder, i, -1),
                        }))
                      }
                      disabled={i === 0}
                      className="rounded border border-slate-600 px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30 transition-colors"
                      title="Move up"
                    >
                      &uarr;
                    </button>
                    <button
                      onClick={() =>
                        updateForm((f) => ({
                          ...f,
                          fallbackOrder: moveItem(f.fallbackOrder, i, 1),
                        }))
                      }
                      disabled={i === form.fallbackOrder.length - 1}
                      className="rounded border border-slate-600 px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30 transition-colors"
                      title="Move down"
                    >
                      &darr;
                    </button>
                    <button
                      onClick={() =>
                        updateForm((f) => ({
                          ...f,
                          fallbackOrder: f.fallbackOrder.filter((e) => e.id !== entry.id),
                        }))
                      }
                      className="rounded border border-red-800/50 px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-900/30 transition-colors"
                      title="Remove"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  updateForm((f) => ({
                    ...f,
                    fallbackOrder: [
                      ...f.fallbackOrder,
                      { id: String(nextFbId++), model: "" },
                    ],
                  }))
                }
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                + Add Fallback
              </button>
            </div>

            {/* Per-agent model overrides */}
            {agents.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">
                  Per-Agent Model Overrides
                </label>
                <div className="space-y-2">
                  {agents.map((agent) => (
                    <div key={agent.agentId} className="flex items-center gap-3">
                      <span className="w-32 truncate font-mono text-xs text-slate-400">
                        {agent.agentId}
                      </span>
                      <ModelSelect
                        value={form.agentModels[agent.agentId] ?? ""}
                        models={models}
                        onChange={(v) =>
                          updateForm((f) => ({
                            ...f,
                            agentModels: { ...f.agentModels, [agent.agentId]: v },
                          }))
                        }
                        placeholder="Use default"
                        className="flex-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>

      {/* Section B: Agent Defaults */}
      <CollapsibleSection
        title="Agent Settings"
        sectionId="agent-defaults"
        expanded={expandedSections.has("agent-defaults")}
        onToggle={() => toggleSection("agent-defaults")}
      >
        {form && agents.length > 0 ? (
          <div className="space-y-4">
            {agents.map((agent) => {
              const def = form.agentDefaults[agent.agentId] ?? {
                heartbeatEnabled: false,
                heartbeatIntervalMs: 300000,
                heartbeatPrompt: "",
              };
              return (
                <div
                  key={agent.agentId}
                  className="rounded-md border border-slate-700 bg-slate-900/50 p-4 space-y-3"
                >
                  <h4 className="font-mono text-sm text-white">{agent.agentId}</h4>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={def.heartbeatEnabled}
                        onChange={(e) =>
                          updateForm((f) => ({
                            ...f,
                            agentDefaults: {
                              ...f.agentDefaults,
                              [agent.agentId]: {
                                ...def,
                                heartbeatEnabled: e.target.checked,
                              },
                            },
                          }))
                        }
                        className="rounded border-slate-600 bg-slate-800"
                      />
                      Heartbeat
                    </label>
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-slate-500">Interval (ms)</label>
                      <input
                        type="number"
                        value={def.heartbeatIntervalMs}
                        onChange={(e) =>
                          updateForm((f) => ({
                            ...f,
                            agentDefaults: {
                              ...f.agentDefaults,
                              [agent.agentId]: {
                                ...def,
                                heartbeatIntervalMs: Number(e.target.value) || 300000,
                              },
                            },
                          }))
                        }
                        className="w-28 rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
                        disabled={!def.heartbeatEnabled}
                      />
                    </div>
                  </div>
                  {def.heartbeatEnabled && (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">Heartbeat Prompt</label>
                      <textarea
                        value={def.heartbeatPrompt}
                        onChange={(e) =>
                          updateForm((f) => ({
                            ...f,
                            agentDefaults: {
                              ...f.agentDefaults,
                              [agent.agentId]: {
                                ...def,
                                heartbeatPrompt: e.target.value,
                              },
                            },
                          }))
                        }
                        rows={3}
                        className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white font-mono focus:border-blue-500 focus:outline-none resize-y"
                        placeholder="Custom heartbeat prompt..."
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No agents connected.</p>
        )}
      </CollapsibleSection>

      {/* Section C: Channels */}
      <CollapsibleSection
        title="Channels"
        sectionId="channels"
        expanded={expandedSections.has("channels")}
        onToggle={() => toggleSection("channels")}
      >
        {form && form.channels.length > 0 ? (
          <div className="space-y-4">
            {redacted && (
              <div className="rounded-md bg-slate-700/50 px-3 py-2 text-xs text-slate-400">
                Token values may be redacted by the server.
              </div>
            )}
            {form.channels.map((ch) => (
              <div
                key={ch.id}
                className="rounded-md border border-slate-700 bg-slate-900/50 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-mono text-sm text-white">{ch.id}</h4>
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={ch.enabled}
                      onChange={(e) =>
                        updateForm((f) => ({
                          ...f,
                          channels: f.channels.map((c) =>
                            c.id === ch.id ? { ...c, enabled: e.target.checked } : c,
                          ),
                        }))
                      }
                      className="rounded border-slate-600 bg-slate-800"
                    />
                    Enabled
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-500 w-12">Mode</label>
                  <select
                    value={ch.mode}
                    onChange={(e) =>
                      updateForm((f) => ({
                        ...f,
                        channels: f.channels.map((c) =>
                          c.id === ch.id ? { ...c, mode: e.target.value } : c,
                        ),
                      }))
                    }
                    className="flex-1 rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="polling">Polling</option>
                    <option value="webhook">Webhook</option>
                    <option value="websocket">WebSocket</option>
                    <option value="irc">IRC</option>
                    <option value="discord">Discord</option>
                    <option value="slack">Slack</option>
                    <option value="telegram">Telegram</option>
                    <option value="matrix">Matrix</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-500 w-12">Token</label>
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type={revealedTokens.has(ch.id) ? "text" : "password"}
                      value={ch.token}
                      onChange={(e) =>
                        updateForm((f) => ({
                          ...f,
                          channels: f.channels.map((c) =>
                            c.id === ch.id ? { ...c, token: e.target.value } : c,
                          ),
                        }))
                      }
                      className="flex-1 rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                      placeholder="Channel token"
                    />
                    <button
                      onClick={() =>
                        setRevealedTokens((prev) => {
                          const next = new Set(prev);
                          if (next.has(ch.id)) next.delete(ch.id);
                          else next.add(ch.id);
                          return next;
                        })
                      }
                      className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      {revealedTokens.has(ch.id) ? "Hide" : "Reveal"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No channels configured.</p>
        )}
      </CollapsibleSection>

      {/* Section D: Server */}
      <CollapsibleSection
        title="Server"
        sectionId="server"
        expanded={expandedSections.has("server")}
        onToggle={() => toggleSection("server")}
      >
        {form && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-300 w-24">Port</label>
              <input
                type="number"
                value={form.server.port}
                onChange={(e) =>
                  updateForm((f) => ({
                    ...f,
                    server: { ...f.server, port: Number(e.target.value) || 18789 },
                  }))
                }
                className="w-28 rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-300 w-24">Host</label>
              <input
                type="text"
                value={form.server.host}
                onChange={(e) =>
                  updateForm((f) => ({
                    ...f,
                    server: { ...f.server, host: e.target.value },
                  }))
                }
                className="flex-1 rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                placeholder="0.0.0.0"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-300 w-24">Auth</label>
              <select
                value={form.server.authMethod}
                onChange={(e) =>
                  updateForm((f) => ({
                    ...f,
                    server: { ...f.server, authMethod: e.target.value },
                  }))
                }
                className="flex-1 rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="none">None</option>
                <option value="token">Token</option>
                <option value="password">Password</option>
              </select>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Configuration"}
        </button>
        {saved && (
          <span className="text-sm text-green-400">
            Saved — gateway restarting
          </span>
        )}
      </div>

      {saveError && (
        <div className="rounded-md bg-red-900/30 border border-red-800/50 px-3 py-2 text-sm text-red-400">
          {saveError}
          {saveError.includes("re-fetch") && (
            <button onClick={handleRawRefetch} className="ml-2 underline hover:text-red-300">
              Re-fetch now
            </button>
          )}
        </div>
      )}

      {/* Unknown sections */}
      {form && Object.keys(form.unknownSections).length > 0 && (
        <CollapsibleSection
          title="Other Config Sections"
          sectionId="unknown"
          expanded={expandedSections.has("unknown")}
          onToggle={() => toggleSection("unknown")}
        >
          <div className="space-y-4">
            {Object.entries(form.unknownSections).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <label className="font-mono text-xs text-slate-400">{key}</label>
                <CodeEditor
                  value={ensureString(value)}
                  language="json"
                  readOnly
                  minHeight="80px"
                />
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Section E: Raw Config Editor */}
      <CollapsibleSection
        title="Raw Configuration"
        sectionId="raw"
        expanded={rawExpanded}
        onToggle={() => setRawExpanded(!rawExpanded)}
      >
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex items-center gap-2">
            {rawEditing ? (
              <>
                <button
                  onClick={handleRawSave}
                  disabled={rawSaving}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {rawSaving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleRawCancel}
                  disabled={rawSaving}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setRawEditing(true)}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleRawRefetch}
                  disabled={configReq.loading}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {configReq.loading ? "Fetching..." : "Re-fetch"}
                </button>
              </>
            )}
            {rawSaved && !rawEditing && (
              <span className="text-xs text-green-400">
                Saved — gateway restarting
              </span>
            )}
          </div>

          {/* Error */}
          {rawError && (
            <div className="rounded-md bg-red-900/30 border border-red-800/50 px-3 py-2 text-sm text-red-400">
              {rawError}
              {rawError.includes("re-fetch") && (
                <button onClick={handleRawRefetch} className="ml-2 underline hover:text-red-300">
                  Re-fetch now
                </button>
              )}
            </div>
          )}

          {/* Editor */}
          <CodeEditor
            value={rawEditing ? editConfig : rawConfig}
            onChange={rawEditing ? setEditConfig : undefined}
            language="json"
            readOnly={!rawEditing}
            minHeight="300px"
          />

          {baseHash && (
            <p className="text-xs text-slate-600">
              Config hash: {baseHash.slice(0, 12)}...
            </p>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function CollapsibleSection({
  title,
  sectionId,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  sectionId: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section id={sectionId} className="rounded-lg border border-slate-700 bg-slate-800">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <span className="text-slate-400 text-lg">{expanded ? "-" : "+"}</span>
      </button>
      {expanded && <div className="px-6 pb-6">{children}</div>}
    </section>
  );
}

function ModelSelect({
  value,
  models,
  onChange,
  placeholder = "Select model",
  className = "",
  id,
}: {
  value: string;
  models: ModelInfo[];
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
    >
      <option value="">{placeholder}</option>
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name ?? m.id}
          {m.provider ? ` (${m.provider})` : ""}
        </option>
      ))}
      {value && !models.find((m) => m.id === value) && (
        <option value={value}>{value}</option>
      )}
    </select>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function moveItem<T>(arr: T[], index: number, direction: -1 | 1): T[] {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= arr.length) return arr;
  const result = [...arr];
  [result[index], result[newIndex]] = [result[newIndex], result[index]];
  return result;
}

function isConflictError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return lower.includes("hash") || lower.includes("conflict") || lower.includes("stale");
}
