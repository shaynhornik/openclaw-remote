/**
 * ED25519 device identity for browser.
 * Ported from openclaw/ui/src/ui/device-identity.ts
 */
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";
import { bytesToBase64url, base64urlToBytes } from "@/utils/base64url";
import { getItem, setItem } from "@/utils/storage";
import { uuid } from "@/utils/uuid";

// noble/ed25519 v2 requires configuring sha512
ed.etc.sha512Sync = (...m: Uint8Array[]) => {
  const h = sha512.create();
  for (const chunk of m) h.update(chunk);
  return h.digest();
};

const STORAGE_KEY = "openclaw-remote:device-identity";

export interface DeviceIdentity {
  id: string;
  publicKey: string; // base64url
  privateKey: string; // base64url
}

export function getOrCreateDeviceIdentity(): DeviceIdentity {
  const stored = getItem<DeviceIdentity>(STORAGE_KEY);
  if (stored?.id && stored?.publicKey && stored?.privateKey) {
    return stored;
  }

  const privateKeyBytes = ed.utils.randomPrivateKey();
  const publicKeyBytes = ed.getPublicKey(privateKeyBytes);

  const identity: DeviceIdentity = {
    id: uuid(),
    publicKey: bytesToBase64url(publicKeyBytes),
    privateKey: bytesToBase64url(privateKeyBytes),
  };

  setItem(STORAGE_KEY, identity);
  return identity;
}

export function signPayload(
  privateKeyBase64url: string,
  payload: string,
): string {
  const privateKeyBytes = base64urlToBytes(privateKeyBase64url);
  const messageBytes = new TextEncoder().encode(payload);
  const signatureBytes = ed.sign(messageBytes, privateKeyBytes);
  return bytesToBase64url(signatureBytes);
}
