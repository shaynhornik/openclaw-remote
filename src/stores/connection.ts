import { create } from "zustand";
import type { ConnectionStatus } from "@/gateway/client";
import { GatewayClient } from "@/gateway/client";
import { ConnectionManager } from "@/gateway/connection-manager";
import { dispatchEvent } from "@/gateway/event-dispatcher";
import {
  getOrCreateDeviceIdentity,
  signPayload,
} from "@/gateway/device-identity";
import { getDeviceToken, setDeviceToken } from "@/gateway/device-auth-store";
import { buildDeviceAuthPayload } from "@/protocol/device-auth-payload";
import {
  PROTOCOL_VERSION,
  CLIENT_ID,
  CLIENT_VERSION,
  CLIENT_PLATFORM,
  CLIENT_MODE,
  DEFAULT_ROLE,
  DEFAULT_SCOPES,
  DEFAULT_CAPS,
} from "@/protocol/constants";
import type { ConnectParams, HelloOk, GatewaySnapshot } from "@/protocol/types";
import { getItem, setItem } from "@/utils/storage";
import { useAuthStore } from "./auth";
import { usePresenceStore } from "./presence";
import { useAgentsStore } from "./agents";
import { useSessionsStore } from "./sessions";
import { useChannelsStore } from "./channels";
import { useApprovalsStore } from "./approvals";
import { useCronStore } from "./cron";
import { useChatStore } from "./chat";
import { useUsageStore } from "./usage";

const URL_STORAGE_KEY = "openclaw-remote:gateway-url";

interface ConnectionState {
  url: string;
  status: ConnectionStatus;
  hello: HelloOk | null;
  error: string | null;
  tickIntervalMs: number;

  setUrl: (url: string) => void;
  connect: () => void;
  disconnect: () => void;
  onTick: () => void;
  handleShutdown: () => void;

  // Internal
  _client: GatewayClient | null;
  _manager: ConnectionManager | null;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  url: getItem<string>(URL_STORAGE_KEY) ?? "",
  status: "disconnected",
  hello: null,
  error: null,
  tickIntervalMs: 5000,
  _client: null,
  _manager: null,

  setUrl: (url: string) => {
    setItem(URL_STORAGE_KEY, url);
    set({ url });
  },

  connect: () => {
    const { url, _manager } = get();
    if (!url) {
      set({ error: "Gateway URL is required" });
      return;
    }

    // Cleanup existing connection
    if (_manager) {
      _manager.stop();
    }

    const client = new GatewayClient();

    client.setEventHandler((frame) => {
      dispatchEvent(frame);
    });

    client.setStatusHandler((status) => {
      set({ status });
    });

    const buildParams = (nonce: string): ConnectParams => {
      const authState = useAuthStore.getState();
      const identity = getOrCreateDeviceIdentity();
      const deviceToken = getDeviceToken();
      const signedAt = Date.now();
      const params: ConnectParams = {
        minProtocol: PROTOCOL_VERSION,
        maxProtocol: PROTOCOL_VERSION,
        client: {
          id: CLIENT_ID,
          version: CLIENT_VERSION,
          platform: CLIENT_PLATFORM,
          mode: CLIENT_MODE,
        },
        role: DEFAULT_ROLE,
        scopes: [...DEFAULT_SCOPES],
        caps: [...DEFAULT_CAPS],
      };

      // Always send device identity — the gateway requires it
      const payload = buildDeviceAuthPayload({
        deviceId: identity.id,
        clientId: CLIENT_ID,
        clientMode: CLIENT_MODE,
        role: DEFAULT_ROLE,
        scopes: [...DEFAULT_SCOPES],
        signedAt,
        token: deviceToken ?? "",
        nonce,
      });

      const signature = signPayload(identity.privateKey, payload);

      params.device = {
        id: identity.id,
        publicKey: identity.publicKey,
        signature,
        signedAt,
        nonce,
      };

      // Auth
      if (deviceToken || authState.token || authState.password) {
        params.auth = {};
        if (deviceToken ?? authState.token) {
          params.auth.token = deviceToken ?? authState.token ?? undefined;
        }
        if (authState.password) {
          params.auth.password = authState.password;
        }
      }

      return params;
    };

    const manager = new ConnectionManager(
      client,
      () => get().url,
      buildParams,
      (hello: HelloOk) => {
        const tick = hello.policy?.tickIntervalMs ?? hello.tickIntervalMs ?? 30_000;
        set({ hello, error: null, tickIntervalMs: tick });

        // Store device token if provided
        if (hello.device?.token) {
          setDeviceToken(hello.device.token);
        }

        // Extract and store session key
        const sessionKey =
          hello.snapshot?.sessionDefaults?.mainSessionKey ??
          hello.snapshot?.sessionDefaults?.mainKey ??
          "";
        if (sessionKey) {
          useChatStore.getState().setSessionKey(sessionKey);
        }

        // Apply snapshot
        if (hello.snapshot) {
          applySnapshot(hello.snapshot);
        }

        // Fetch additional data via RPC
        fetchPostConnectData(client, sessionKey);
      },
      () => {
        // on disconnected
      },
      (err: Error) => {
        set({ error: err.message });
      },
    );

    set({ _client: client, _manager: manager });
    manager.start();
  },

  disconnect: () => {
    const { _manager } = get();
    if (_manager) {
      _manager.stop();
    }
    set({
      status: "disconnected",
      hello: null,
      error: null,
      _client: null,
      _manager: null,
    });
  },

  onTick: () => {
    const { _manager, tickIntervalMs } = get();
    if (_manager) {
      _manager.onTick(tickIntervalMs);
    }
  },

  handleShutdown: () => {
    const { _manager } = get();
    if (_manager) {
      _manager.stop();
    }
    set({
      status: "disconnected",
      hello: null,
      error: "Server shut down",
    });
  },
}));

function applySnapshot(snapshot: GatewaySnapshot): void {
  if (snapshot.presence) {
    usePresenceStore.getState().setPresence(snapshot.presence);
  }
  if (snapshot.health) {
    usePresenceStore.getState().setHealth(snapshot.health);
    // Seed agents from health snapshot
    if (snapshot.health.agents) {
      useAgentsStore.getState().setAgents(snapshot.health.agents);
    }
    // Seed sessions from health snapshot
    if (snapshot.health.sessions?.recent) {
      useSessionsStore.getState().setSessions(
        snapshot.health.sessions.recent.map((s) => ({
          key: s.key,
          updatedAt: s.updatedAt,
          age: s.age,
        })),
      );
    }
    // Seed channels from health snapshot
    if (snapshot.health.channels) {
      const channelEntries = Object.entries(snapshot.health.channels);
      const labels = snapshot.health.channelLabels ?? {};
      useChannelsStore.getState().setChannels(
        channelEntries.map(([id, ch]) => ({
          id,
          name: labels[id] ?? id,
          type: ch.mode ?? undefined,
          status: ch.lastError
            ? ("error" as const)
            : ch.running
              ? ("active" as const)
              : ("idle" as const),
          configured: ch.configured,
          running: ch.running,
          connectedAt: ch.lastStartAt ?? undefined,
        })),
      );
    }
  }
  if (snapshot.sessions) {
    useSessionsStore.getState().setSessions(snapshot.sessions);
  }
  if (snapshot.channels) {
    useChannelsStore.getState().setChannels(snapshot.channels);
  }
  if (snapshot.approvals) {
    useApprovalsStore.getState().setApprovals(snapshot.approvals);
  }
  if (snapshot.cron) {
    useCronStore.getState().setCronJobs(snapshot.cron);
  }
}

async function fetchPostConnectData(
  client: GatewayClient,
  sessionKey: string,
): Promise<void> {
  // Fetch agents list
  try {
    const agents = await client.request<unknown>("agents.list");
    if (agents && typeof agents === "object") {
      const list = Array.isArray(agents)
        ? agents
        : (agents as Record<string, unknown>).agents;
      if (Array.isArray(list)) {
        useAgentsStore.getState().setAgents(list);
        // Seed usage store from agent snapshots that already carry usage data
        useUsageStore.getState().seedFromAgents(list);
      }
    }
  } catch {
    // Method may not be available
  }

  // Fetch sessions list
  try {
    const sessions = await client.request<unknown>("sessions.list");
    if (sessions && typeof sessions === "object") {
      const list = Array.isArray(sessions)
        ? sessions
        : (sessions as Record<string, unknown>).sessions;
      if (Array.isArray(list)) {
        useSessionsStore.getState().setSessions(list);
      }
    }
  } catch {
    // Method may not be available
  }

  // Fetch chat history (requires sessionKey)
  if (sessionKey) {
    try {
      const history = await client.request<unknown>("chat.history", {
        sessionKey,
        limit: 200,
      });
      if (history && typeof history === "object") {
        const messages = Array.isArray(history)
          ? history
          : (history as Record<string, unknown>).messages;
        if (Array.isArray(messages)) {
          useChatStore.getState().setMessages(messages);
        }
      }
    } catch {
      // Method may not be available
    }
  }

  // Fetch cron jobs
  try {
    const cron = await client.request<unknown>("cron.list");
    if (cron && typeof cron === "object") {
      const list = Array.isArray(cron)
        ? cron
        : (cron as Record<string, unknown>).jobs;
      if (Array.isArray(list)) {
        useCronStore.getState().setCronJobs(list);
      }
    }
  } catch {
    // Method may not be available
  }

  // Fetch usage/cost data
  try {
    const usage = await client.request<unknown>("usage.cost", { days: 30 });
    if (usage && typeof usage === "object") {
      useUsageStore.getState().setUsageData(usage);
    }
  } catch {
    // Method may not be available
  }
}
