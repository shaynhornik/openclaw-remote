/**
 * OpenClaw Remote — gateway plugin entry point.
 *
 * Serves the Remote dashboard as a PWA on the gateway's HTTP server
 * and registers diagnostic RPC methods.
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createUiHandler } from "./serve-ui.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface PluginApi {
  id: string;
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

  // Resolve UI assets: dist/ui/ relative to the plugin package root
  // Plugin source lives in src/plugin/, so package root is ../../
  const packageRoot = join(__dirname, "..", "..");
  const uiRoot = join(packageRoot, "dist", "ui");

  const handler = createUiHandler({ uiRoot, basePath });
  api.registerHttpHandler(handler);

  // Register a diagnostic RPC method
  api.registerGatewayMethod("remote.ping", ({ respond }) => {
    respond(true, {
      plugin: "openclaw-remote",
      version: "0.1.0",
      basePath,
      ui: uiRoot,
    });
  });

  // Register a chat command so users can get the dashboard URL
  api.registerCommand({
    name: "remote",
    description: "Show the Remote dashboard URL",
    acceptsArgs: false,
    requireAuth: false,
    handler: () => ({
      text: `Remote dashboard available at: ${basePath}/\n\nOpen this path on your gateway's address to access the dashboard. On mobile, scan the QR code in the Settings tab.`,
    }),
  });

  api.logger.info(`Remote dashboard serving at ${basePath}/`);
}
