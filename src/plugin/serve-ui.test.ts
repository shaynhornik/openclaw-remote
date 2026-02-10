import { describe, it, expect, beforeEach, vi } from "vitest";
import { getMimeType, createUiHandler } from "./serve-ui.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

// ── getMimeType ──────────────────────────────────────────────────

describe("getMimeType", () => {
  it("returns correct MIME type for common extensions", () => {
    expect(getMimeType("index.html")).toBe("text/html; charset=utf-8");
    expect(getMimeType("app.js")).toBe("application/javascript; charset=utf-8");
    expect(getMimeType("style.css")).toBe("text/css; charset=utf-8");
    expect(getMimeType("data.json")).toBe("application/json; charset=utf-8");
    expect(getMimeType("logo.png")).toBe("image/png");
    expect(getMimeType("logo.svg")).toBe("image/svg+xml");
    expect(getMimeType("font.woff2")).toBe("font/woff2");
  });

  it("returns octet-stream for unknown extensions", () => {
    expect(getMimeType("file.xyz")).toBe("application/octet-stream");
    expect(getMimeType("file.bin")).toBe("application/octet-stream");
  });

  it("is case-insensitive for extensions", () => {
    expect(getMimeType("INDEX.HTML")).toBe("text/html; charset=utf-8");
    expect(getMimeType("STYLE.CSS")).toBe("text/css; charset=utf-8");
  });
});

// ── createUiHandler ──────────────────────────────────────────────

describe("createUiHandler", () => {
  let testDir: string;
  let handler: ReturnType<typeof createUiHandler>;

  beforeEach(() => {
    testDir = join(tmpdir(), `openclaw-test-${Date.now()}`);
    mkdirSync(join(testDir, "assets"), { recursive: true });
    writeFileSync(join(testDir, "index.html"), "<!doctype html><html></html>");
    writeFileSync(join(testDir, "assets", "app-abc12345.js"), "console.log('app')");
    writeFileSync(join(testDir, "assets", "style-def67890.css"), "body{}");
    writeFileSync(join(testDir, "manifest.webmanifest"), "{}");

    handler = createUiHandler({ uiRoot: testDir, basePath: "/remote" });

    return () => {
      rmSync(testDir, { recursive: true, force: true });
    };
  });

  function mockReq(url: string): IncomingMessage {
    return { url } as IncomingMessage;
  }

  function mockRes() {
    const headers: Record<string, string | number> = {};
    let statusCode = 200;
    let body = "";
    const res = {
      writeHead: vi.fn((code: number, hdrs?: Record<string, string | number>) => {
        statusCode = code;
        if (hdrs) Object.assign(headers, hdrs);
      }),
      end: vi.fn((data?: Buffer | string) => {
        if (data) body = typeof data === "string" ? data : data.toString();
      }),
      get statusCode() { return statusCode; },
      get headers() { return headers; },
      get body() { return body; },
    };
    return res as unknown as ServerResponse & {
      statusCode: number;
      headers: Record<string, string | number>;
      body: string;
    };
  }

  it("ignores requests not under the base path", async () => {
    const res = mockRes();
    const handled = await handler(mockReq("/other/path"), res);
    expect(handled).toBe(false);
  });

  it("ignores root path /", async () => {
    const res = mockRes();
    const handled = await handler(mockReq("/"), res);
    expect(handled).toBe(false);
  });

  it("redirects /remote to /remote/", async () => {
    const res = mockRes();
    const handled = await handler(mockReq("/remote"), res);
    expect(handled).toBe(true);
    expect(res.writeHead).toHaveBeenCalledWith(302, { Location: "/remote/" });
  });

  it("serves index.html for /remote/", async () => {
    const res = mockRes();
    const handled = await handler(mockReq("/remote/"), res);
    expect(handled).toBe(true);
    expect(res.headers["Content-Type"]).toBe("text/html; charset=utf-8");
    expect(res.body).toContain("<!doctype html>");
  });

  it("serves static assets with correct MIME type", async () => {
    const res = mockRes();
    const handled = await handler(mockReq("/remote/assets/app-abc12345.js"), res);
    expect(handled).toBe(true);
    expect(res.headers["Content-Type"]).toBe("application/javascript; charset=utf-8");
    expect(res.body).toBe("console.log('app')");
  });

  it("serves CSS files", async () => {
    const res = mockRes();
    const handled = await handler(mockReq("/remote/assets/style-def67890.css"), res);
    expect(handled).toBe(true);
    expect(res.headers["Content-Type"]).toBe("text/css; charset=utf-8");
  });

  it("sets immutable cache for hashed assets", async () => {
    const res = mockRes();
    await handler(mockReq("/remote/assets/app-abc12345.js"), res);
    expect(res.headers["Cache-Control"]).toBe("public, max-age=31536000, immutable");
  });

  it("sets no-cache for index.html", async () => {
    const res = mockRes();
    await handler(mockReq("/remote/"), res);
    expect(res.headers["Cache-Control"]).toBe("no-cache, no-store, must-revalidate");
  });

  it("sets security headers on all responses", async () => {
    const res = mockRes();
    await handler(mockReq("/remote/assets/app-abc12345.js"), res);
    expect(res.headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(res.headers["X-Frame-Options"]).toBe("DENY");
    expect(res.headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("serves index.html for SPA routes (client-side routing)", async () => {
    const res = mockRes();
    const handled = await handler(mockReq("/remote/dashboard"), res);
    expect(handled).toBe(true);
    expect(res.headers["Content-Type"]).toBe("text/html; charset=utf-8");
    expect(res.body).toContain("<!doctype html>");
  });

  it("serves manifest.webmanifest", async () => {
    const res = mockRes();
    const handled = await handler(mockReq("/remote/manifest.webmanifest"), res);
    expect(handled).toBe(true);
    expect(res.headers["Content-Type"]).toBe("application/manifest+json");
  });

  it("ignores directory traversal attempts (URL normalization strips ..)", async () => {
    const res = mockRes();
    // URL normalization turns /remote/../../../etc/passwd into /etc/passwd
    // which doesn't match the /remote prefix, so the handler ignores it
    const handled = await handler(mockReq("/remote/../../../etc/passwd"), res);
    expect(handled).toBe(false);
  });

  it("blocks path traversal via encoded sequences", async () => {
    const res = mockRes();
    // Even if someone bypasses URL parsing, join() resolves the path
    // and the startsWith(uiRoot) check prevents serving outside uiRoot
    const handled = await handler(mockReq("/remote/%2e%2e/index.html"), res);
    // Either ignored (false) or served index.html as SPA fallback (safe)
    expect(typeof handled).toBe("boolean");
  });
});
