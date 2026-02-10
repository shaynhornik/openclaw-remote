/**
 * Static file server for the OpenClaw Remote dashboard.
 * Serves the built React SPA from dist/ui/ on the gateway's HTTP server.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json",
};

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

const CACHE_IMMUTABLE = "public, max-age=31536000, immutable";
const CACHE_NO = "no-cache, no-store, must-revalidate";

/** Returns true if a filename looks like a hashed asset (e.g., index-Abc123.js) */
function isHashedAsset(filename: string): boolean {
  return /[-.][\da-f]{6,}\.\w+$/i.test(filename);
}

export function getMimeType(filePath: string): string {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export interface ServeUiOptions {
  /** Filesystem path to the built UI assets (directory containing index.html) */
  uiRoot: string;
  /** URL base path, e.g. "/remote" (no trailing slash) */
  basePath: string;
}

/**
 * Creates an HTTP request handler that serves the built React SPA.
 *
 * Returns a function compatible with OpenClaw's `registerHttpHandler`:
 * - Returns `true` if the request was handled
 * - Returns `false` to pass through to the next handler
 */
export function createUiHandler(options: ServeUiOptions) {
  const { uiRoot, basePath } = options;
  const prefix = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  const indexPath = join(uiRoot, "index.html");

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = url.pathname;

    // Only handle requests under our base path
    if (!pathname.startsWith(prefix + "/") && pathname !== prefix) {
      return false;
    }

    // Redirect /remote to /remote/ for consistent routing
    if (pathname === prefix) {
      res.writeHead(302, { Location: prefix + "/" });
      res.end();
      return true;
    }

    // Strip the base path prefix to get the relative file path
    const relativePath = pathname.slice(prefix.length);
    const filePath = join(uiRoot, relativePath);

    // Security: prevent directory traversal
    if (!filePath.startsWith(uiRoot)) {
      res.writeHead(403);
      res.end();
      return true;
    }

    // Try to serve the exact file
    if (relativePath !== "/" && existsSync(filePath)) {
      return serveFile(res, filePath);
    }

    // SPA fallback: serve index.html for all non-file routes
    if (existsSync(indexPath)) {
      return serveFile(res, indexPath, true);
    }

    // UI not built yet
    res.writeHead(503, { "Content-Type": "text/plain" });
    res.end("OpenClaw Remote dashboard not built. Run: npm run build");
    return true;
  };
}

async function serveFile(
  res: ServerResponse,
  filePath: string,
  isSpaFallback = false,
): Promise<true> {
  try {
    const content = await readFile(filePath);
    const mimeType = getMimeType(filePath);
    const cacheControl = isSpaFallback || filePath.endsWith("index.html")
      ? CACHE_NO
      : isHashedAsset(filePath)
        ? CACHE_IMMUTABLE
        : "public, max-age=3600";

    res.writeHead(200, {
      "Content-Type": mimeType,
      "Content-Length": content.byteLength,
      "Cache-Control": cacheControl,
      ...SECURITY_HEADERS,
    });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end();
  }
  return true;
}
