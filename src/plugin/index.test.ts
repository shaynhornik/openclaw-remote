import { describe, it, expect, vi } from "vitest";
import register from "./index.js";

function mockApi() {
  return {
    id: "openclaw-remote",
    pluginConfig: {},
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    registerHttpHandler: vi.fn(),
    registerGatewayMethod: vi.fn(),
    registerCommand: vi.fn(),
  };
}

describe("plugin registration", () => {
  it("registers an HTTP handler", () => {
    const api = mockApi();
    register(api);
    expect(api.registerHttpHandler).toHaveBeenCalledOnce();
    expect(typeof api.registerHttpHandler.mock.calls[0][0]).toBe("function");
  });

  it("registers the remote.ping RPC method", () => {
    const api = mockApi();
    register(api);
    expect(api.registerGatewayMethod).toHaveBeenCalledWith(
      "remote.ping",
      expect.any(Function),
    );
  });

  it("registers the /remote chat command", () => {
    const api = mockApi();
    register(api);
    expect(api.registerCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "remote",
        description: expect.any(String),
      }),
    );
  });

  it("logs the dashboard path", () => {
    const api = mockApi();
    register(api);
    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("/remote/"),
    );
  });

  it("uses custom basePath from config", () => {
    const api = mockApi();
    api.pluginConfig = { basePath: "/dashboard" };
    register(api);
    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("/dashboard/"),
    );
  });

  it("remote.ping responds with plugin info", () => {
    const api = mockApi();
    register(api);

    const pingHandler = api.registerGatewayMethod.mock.calls.find(
      (c: unknown[]) => c[0] === "remote.ping",
    )?.[1];

    const respond = vi.fn();
    pingHandler({ params: {}, respond });

    expect(respond).toHaveBeenCalledWith(true, expect.objectContaining({
      plugin: "openclaw-remote",
      version: "0.1.0",
      basePath: "/remote",
    }));
  });

  it("/remote command returns dashboard URL", () => {
    const api = mockApi();
    register(api);

    const cmd = api.registerCommand.mock.calls[0][0];
    const result = cmd.handler({});

    expect(result.text).toContain("/remote/");
  });
});
