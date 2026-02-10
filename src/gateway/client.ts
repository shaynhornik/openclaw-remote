/**
 * Core WebSocket client for the OpenClaw gateway.
 * Ported from openclaw/ui/src/ui/gateway.ts
 *
 * Responsibilities:
 *  - Open/close the WebSocket
 *  - Send request frames and track pending responses
 *  - Route incoming event/response frames to callbacks
 */
import type {
  Frame,
  RequestFrame,
  ResponseFrame,
  EventFrame,
  ConnectParams,
  HelloOk,
} from "@/protocol/types";
import { uuid } from "@/utils/uuid";

export type EventHandler = (event: EventFrame) => void;
export type StatusHandler = (status: ConnectionStatus) => void;

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "connected"
  | "error";

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const REQUEST_TIMEOUT_MS = 30_000;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private onEvent: EventHandler = () => {};
  private onStatus: StatusHandler = () => {};
  private _status: ConnectionStatus = "disconnected";

  get status(): ConnectionStatus {
    return this._status;
  }

  setEventHandler(handler: EventHandler): void {
    this.onEvent = handler;
  }

  setStatusHandler(handler: StatusHandler): void {
    this.onStatus = handler;
  }

  private setStatus(s: ConnectionStatus): void {
    this._status = s;
    this.onStatus(s);
  }

  /**
   * Open the WebSocket and complete the connect handshake.
   * Returns the HelloOk payload on success.
   */
  async connect(
    url: string,
    buildParams: (nonce: string) => ConnectParams,
  ): Promise<HelloOk> {
    this.disconnect();
    this.setStatus("connecting");

    return new Promise<HelloOk>((resolve, reject) => {
      try {
        const ws = new WebSocket(url);
        this.ws = ws;

        ws.onopen = () => {
          this.setStatus("authenticating");
        };

        ws.onerror = () => {
          this.setStatus("error");
          reject(new Error("WebSocket connection failed"));
          this.cleanup();
        };

        ws.onclose = () => {
          if (this._status !== "error") {
            this.setStatus("disconnected");
          }
          this.flushPending(new Error("Connection closed"));
          this.cleanup();
        };

        // Handle messages during handshake
        let handshakeComplete = false;

        ws.onmessage = (ev: MessageEvent) => {
          let frame: Frame;
          try {
            frame = JSON.parse(ev.data as string) as Frame;
          } catch {
            return;
          }

          // During handshake, wait for connect.challenge
          if (!handshakeComplete && frame.type === "event") {
            const eventFrame = frame as EventFrame;
            if (eventFrame.event === "connect.challenge") {
              const nonce = (eventFrame.payload as { nonce: string }).nonce;
              const params = buildParams(nonce);
              const reqId = uuid();

              const connectReq: RequestFrame = {
                type: "req",
                id: reqId,
                method: "connect",
                params,
              };

              ws.send(JSON.stringify(connectReq));

              // Now wait for the response
              const timer = setTimeout(() => {
                reject(new Error("Connect handshake timed out"));
                this.disconnect();
              }, REQUEST_TIMEOUT_MS);

              this.pending.set(reqId, {
                resolve: (payload) => {
                  clearTimeout(timer);
                  handshakeComplete = true;
                  this.setStatus("connected");
                  // Switch to normal message handler
                  ws.onmessage = this.handleMessage.bind(this);
                  resolve(payload as HelloOk);
                },
                reject: (err) => {
                  clearTimeout(timer);
                  reject(err);
                  this.disconnect();
                },
                timer,
              });
            }
            return;
          }

          // During handshake, handle response to connect request
          if (!handshakeComplete && frame.type === "res") {
            const resFrame = frame as ResponseFrame;
            const pendingReq = this.pending.get(resFrame.id);
            if (pendingReq) {
              this.pending.delete(resFrame.id);
              if (resFrame.ok) {
                pendingReq.resolve(resFrame.payload);
              } else {
                pendingReq.reject(
                  new Error(resFrame.error?.message ?? "Connect rejected"),
                );
              }
            }
          }
        };
      } catch (err) {
        this.setStatus("error");
        reject(err);
      }
    });
  }

  private handleMessage(ev: MessageEvent): void {
    let frame: Frame;
    try {
      frame = JSON.parse(ev.data as string) as Frame;
    } catch {
      return;
    }

    if (frame.type === "event") {
      this.onEvent(frame as EventFrame);
    } else if (frame.type === "res") {
      const res = frame as ResponseFrame;
      const pending = this.pending.get(res.id);
      if (pending) {
        this.pending.delete(res.id);
        clearTimeout(pending.timer);
        if (res.ok) {
          pending.resolve(res.payload);
        } else {
          pending.reject(
            new Error(res.error?.message ?? "Request failed"),
          );
        }
      }
    }
  }

  /**
   * Send an RPC request and return the response payload.
   */
  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }

    const id = uuid();
    const frame: RequestFrame = { type: "req", id, method };
    if (params !== undefined) {
      frame.params = params;
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });

      this.ws!.send(JSON.stringify(frame));
    });
  }

  disconnect(): void {
    if (this.ws) {
      // Remove handlers to prevent reconnect-on-close cycles
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.flushPending(new Error("Disconnected"));
    this.setStatus("disconnected");
  }

  private cleanup(): void {
    this.ws = null;
  }

  private flushPending(err: Error): void {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
      this.pending.delete(id);
    }
  }
}
