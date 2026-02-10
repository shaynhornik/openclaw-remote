/**
 * Manages WebSocket reconnection with exponential backoff.
 */
import {
  RECONNECT_INITIAL_MS,
  RECONNECT_MULTIPLIER,
  RECONNECT_MAX_MS,
  TICK_MISS_FACTOR,
} from "@/protocol/constants";
import type { GatewayClient } from "./client";
import type { ConnectParams, HelloOk } from "@/protocol/types";

export type ConnectFn = (
  client: GatewayClient,
  url: string,
  buildParams: (nonce: string) => ConnectParams,
) => Promise<HelloOk>;

export class ConnectionManager {
  private backoff = RECONNECT_INITIAL_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setTimeout> | null = null;
  private enabled = false;

  constructor(
    private client: GatewayClient,
    private url: () => string,
    private buildParams: (nonce: string) => ConnectParams,
    private onConnected: (hello: HelloOk) => void,
    private onDisconnected: () => void,
    private onError: (err: Error) => void,
  ) {}

  start(): void {
    this.enabled = true;
    this.backoff = RECONNECT_INITIAL_MS;
    this.attemptConnect();
  }

  stop(): void {
    this.enabled = false;
    this.clearTimers();
    this.client.disconnect();
  }

  /** Called when a tick event is received – resets the liveness timer */
  onTick(tickIntervalMs: number): void {
    this.resetTickTimer(tickIntervalMs);
  }

  private async attemptConnect(): Promise<void> {
    if (!this.enabled) return;

    try {
      const hello = await this.client.connect(
        this.url(),
        this.buildParams,
      );
      this.backoff = RECONNECT_INITIAL_MS;
      this.resetTickTimer(hello.policy?.tickIntervalMs ?? hello.tickIntervalMs ?? 30_000);
      this.onConnected(hello);
    } catch (err) {
      this.onError(
        err instanceof Error ? err : new Error(String(err)),
      );
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.enabled) return;
    this.onDisconnected();

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.attemptConnect();
    }, this.backoff);

    this.backoff = Math.min(
      this.backoff * RECONNECT_MULTIPLIER,
      RECONNECT_MAX_MS,
    );
  }

  private resetTickTimer(tickIntervalMs: number): void {
    if (this.tickTimer) clearTimeout(this.tickTimer);
    this.tickTimer = setTimeout(() => {
      // No tick received within 2x interval → reconnect
      this.client.disconnect();
      this.scheduleReconnect();
    }, tickIntervalMs * TICK_MISS_FACTOR);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.tickTimer) {
      clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }
  }
}
