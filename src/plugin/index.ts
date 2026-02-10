/**
 * OpenClaw Remote — gateway plugin entry point.
 *
 * Serves the Remote dashboard as a PWA on the gateway's HTTP server
 * and registers diagnostic RPC methods.
 */
import { join, dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { createUiHandler } from "./serve-ui.js";

/**
 * Resolve the UI assets directory. Tries multiple strategies because
 * jiti (OpenClaw's runtime TS loader) may not set import.meta.url
 * to the actual source file path.
 */
function resolveUiRoot(): string {
  const candidates: string[] = [];

  // Strategy 1: import.meta.url (works in native ESM)
  try {
    const { fileURLToPath } = require("node:url");
    const thisDir = dirname(fileURLToPath(import.meta.url));
    candidates.push(join(thisDir, "..", "..", "dist", "ui"));
  } catch {
    // import.meta.url not available or not a file: URL
  }

  // Strategy 2: __filename (set by jiti/CJS)
  try {
    if (typeof __filename !== "undefined") {
      candidates.push(join(dirname(__filename), "..", "..", "dist", "ui"));
    }
  } catch {
    // __filename not defined
  }

  // Strategy 3: process.cwd-relative (if installed locally)
  candidates.push(resolve("dist", "ui"));

  // Strategy 4: known install paths
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  if (home) {
    candidates.push(join(home, ".openclaw", "extensions", "openclaw-remote", "dist", "ui"));
    candidates.push(join(home, "openclaw-remote", "dist", "ui"));
  }

  // Strategy 5: OPENCLAW_HOME override
  const openclawHome = process.env.OPENCLAW_HOME;
  if (openclawHome) {
    candidates.push(join(openclawHome, "extensions", "openclaw-remote", "dist", "ui"));
  }

  for (const candidate of candidates) {
    if (existsSync(join(candidate, "index.html"))) {
      return candidate;
    }
  }

  // Return the first candidate as default (serve-ui will show a helpful error)
  return candidates[0] ?? join("dist", "ui");
}

interface PluginApi {
  id: string;
  source?: string;
  pluginConfig: Record<string, unknown>;
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  registerHttpHandler: (
    handler: (
      req: import("node:http").IncomingMessage,
      res: import("node:http").ServerResponse,
    ) => Promise<boolean>,
  ) => void;
  registerGatewayMethod: (
    method: string,
    handler: (ctx: {
      params: unknown;
      respond: (ok: boolean, payload: unknown) => void;
    }) => void,
  ) => void;
  registerCommand: (command: {
    name: string;
    description: string;
    acceptsArgs: boolean;
    requireAuth: boolean;
    handler: (ctx: unknown) => { text: string };
  }) => void;
}

export default function register(api: PluginApi): void {
  const basePath = String(api.pluginConfig?.basePath ?? "/remote");
  const uiRoot = resolveUiRoot();
  const uiFound = existsSync(join(uiRoot, "index.html"));

  const handler = createUiHandler({ uiRoot, basePath });
  api.registerHttpHandler(handler);

  api.registerGatewayMethod("remote.ping", ({ respond }) => {
    respond(true, {
      plugin: "openclaw-remote",
      version: "0.1.0",
      basePath,
      uiRoot,
      uiFound,
    });
  });

  api.registerCommand({
    name: "remote",
    description: "Show the Remote dashboard URL",
    acceptsArgs: false,
    requireAuth: false,
    handler: () => ({
      text: `Remote dashboard available at: ${basePath}/\n\nOpen this path on your gateway's address to access the dashboard. On mobile, scan the QR code in the Settings tab.`,
    }),
  });

  if (uiFound) {
    api.logger.info(`Remote dashboard serving at ${basePath}/ (from ${uiRoot})`);
  } else {
    api.logger.warn(`Remote dashboard UI not found at ${uiRoot} — run 'npm run build' in the plugin directory`);
  }
}
