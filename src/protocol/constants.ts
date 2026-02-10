export const PROTOCOL_VERSION = 3;

export const CLIENT_ID = "openclaw-control-ui";
export const CLIENT_VERSION = "0.1.0";
export const CLIENT_PLATFORM = "web";
export const CLIENT_MODE = "webchat";

export const DEFAULT_ROLE = "operator";
export const DEFAULT_SCOPES = [
  "operator.admin",
  "operator.approvals",
  "operator.pairing",
] as const;

export const READ_ONLY_SCOPES = ["operator.read"] as const;

export const DEFAULT_CAPS = ["tool-events"] as const;

export const RECONNECT_INITIAL_MS = 800;
export const RECONNECT_MULTIPLIER = 1.7;
export const RECONNECT_MAX_MS = 15_000;

export const TICK_MISS_FACTOR = 2;
