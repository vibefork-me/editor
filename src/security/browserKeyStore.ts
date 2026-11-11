/**
 * Browser-side ECDSA P-256 key store backed by IndexedDB.
 *
 * - Private key is non-extractable (mitigates XSS key theft).
 * - Public key is exported as JWK for /v1/pair/start.
 * - Paired keyId persists across page reloads so re-pairing is not needed.
 * - The agent's public key from pairing is kept next to it: the editor talks only to an agent that
 *   proves it holds the private part.
 */

import type { AgentPublicKey } from "../client/agent-base-url.ts";

const DB_NAME = "vibefork_keystore";
const STORE_NAME = "identity";
const RECORD_ID = "default";

export interface StoredIdentity {
  id: string;
  keyPair: CryptoKeyPair;
  keyId?: string;
  pairedAt?: string;
  agentKey?: AgentPublicKey;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readIdentity(db: IDBDatabase): Promise<StoredIdentity | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(RECORD_ID);
    req.onsuccess = () => resolve((req.result as StoredIdentity) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function writeIdentity(db: IDBDatabase, identity: StoredIdentity): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(identity);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false, // extractable = false for private key
    ["sign", "verify"]
  );
}

/**
 * Get or create the browser identity (ECDSA P-256 key pair in IndexedDB).
 */
export async function getOrCreateIdentity(): Promise<StoredIdentity> {
  const db = await openDb();
  try {
    const existing = await readIdentity(db);
    if (existing?.keyPair) {
      return existing;
    }
    const keyPair = await generateKeyPair();
    const identity: StoredIdentity = { id: RECORD_ID, keyPair };
    await writeIdentity(db, identity);
    return identity;
  } finally {
    db.close();
  }
}

/**
 * Export the public key as JWK (kty: EC, crv: P-256, x, y — no d field).
 */
export async function exportPublicKeyJwk(
  keyPair: CryptoKeyPair
): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", keyPair.publicKey);
}

/**
 * Sign a nonce string with the private key, returning base64url signature.
 */
export async function signNonce(
  privateKey: CryptoKey,
  nonce: string
): Promise<string> {
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    encoder.encode(nonce)
  );
  return arrayBufferToBase64Url(signature);
}

/**
 * Save the keyId and the agent's public key returned by the agent after successful pairing.
 */
export async function savePairedKeyId(keyId: string, agentKey: AgentPublicKey): Promise<void> {
  const db = await openDb();
  try {
    const existing = await readIdentity(db);
    if (!existing) throw new Error("No identity to update");
    existing.keyId = keyId;
    existing.agentKey = { kty: agentKey.kty, crv: agentKey.crv, x: agentKey.x, y: agentKey.y };
    existing.pairedAt = new Date().toISOString();
    await writeIdentity(db, existing);
  } finally {
    db.close();
  }
}

/**
 * Check if the browser is already paired (has a keyId).
 */
export async function getPairedKeyId(): Promise<string | null> {
  const db = await openDb();
  try {
    const existing = await readIdentity(db);
    return existing?.keyId ?? null;
  } finally {
    db.close();
  }
}

/**
 * The agent's public key from pairing, or `null` when the browser is not paired with one.
 */
export async function getPairedAgentKey(): Promise<AgentPublicKey | null> {
  const db = await openDb();
  try {
    const existing = await readIdentity(db);
    return existing?.keyId && existing.agentKey ? existing.agentKey : null;
  } finally {
    db.close();
  }
}

/**
 * Clear the stored identity (for testing / un-pairing).
 */
export async function clearIdentity(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(RECORD_ID);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
