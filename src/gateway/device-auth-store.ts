/**
 * Persists the device token granted by the server after successful auth.
 * Ported from openclaw/ui/src/ui/device-auth.ts
 */
import { getItem, setItem, removeItem } from "@/utils/storage";

const STORAGE_KEY = "openclaw-remote:device-token";

export function getDeviceToken(): string | null {
  return getItem<string>(STORAGE_KEY);
}

export function setDeviceToken(token: string): void {
  setItem(STORAGE_KEY, token);
}

export function clearDeviceToken(): void {
  removeItem(STORAGE_KEY);
}
