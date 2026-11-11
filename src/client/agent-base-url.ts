import type { IdentityResponse } from "./protocol.generated.ts";

export const AGENT_LOOPBACK_PORTS = [47801, 47802, 47803, 47804, 47805] as const;

export const AGENT_LOOPBACK_HOSTS = ["127.0.0.1"] as const;

const HELLO_PATH = "/v1/hello";

export function resolveAgentBaseUrlFromLocation(locationLike: Pick<Location, "origin" | "pathname">): string | null {
  if (locationLike.pathname.startsWith("/ui/") || locationLike.pathname === "/ui") {
    return locationLike.origin.replace(/\/$/, "");
  }
  return null;
}

export type AgentHelloResponse = {
  agent: string;
  version: string;
  platform: string;
  /** Development build: extra web origins are allowed. */
  extraOriginsActive?: boolean;
};

export async function fetchAgentHello(
  fetchFn: typeof fetch,
  baseUrl: string,
  signal?: AbortSignal,
): Promise<AgentHelloResponse | null> {
  try {
    const res = await fetchFn(`${baseUrl}${HELLO_PATH}`, {
      method: "GET",
      headers: { "x-vibefork": "1" },
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as AgentHelloResponse;
    if (data && typeof data === "object" && typeof data.agent === "string") {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function probeAgentBaseUrl(
  fetchFn: typeof fetch,
  baseUrl: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const hello = await fetchAgentHello(fetchFn, baseUrl, signal);
  return hello !== null;
}

export async function discoverAgentBaseUrl(
  fetchFn: typeof fetch,
  options?: {
    ports?: readonly number[];
    hosts?: readonly string[];
    perAttemptTimeoutMs?: number;
  },
): Promise<string | null> {
  const ports = options?.ports ?? AGENT_LOOPBACK_PORTS;
  const hosts = options?.hosts ?? AGENT_LOOPBACK_HOSTS;
  const timeoutMs = options?.perAttemptTimeoutMs ?? 400;

  for (const host of hosts) {
    for (const port of ports) {
      const base = `http://${host}:${port}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        if (await probeAgentBaseUrl(fetchFn, base, controller.signal)) {
          return base;
        }
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return null;
}

/** The agent's public key the editor got when it paired (EC P-256, no private part). */
export type AgentPublicKey = { kty: string; crv: string; x: string; y: string };

/** More than one program answers on the agent's ports and none is known yet: pairing would be a
 * guess, so the editor does not pair. */
export class AgentConflictError extends Error {
  constructor() {
    super("more than one program answers as the agent");
    this.name = "AgentConflictError";
  }
}

/** Programs answer on the agent's ports, but none proves it holds the paired agent key. */
export class AgentNotVerifiedError extends Error {
  constructor() {
    super("no answering program proves it is the paired agent");
    this.name = "AgentNotVerifiedError";
  }
}

/** First line of the statement the agent signs (`POST /v1/identity`). */
export const AGENT_IDENTITY_CONTEXT = "vibefork-agent-identity-v1";

/** All loopback agent ports that answer `/v1/hello`, asked at the same time, in port order. */
export async function findAnsweringAgents(
  fetchFn: typeof fetch,
  options?: { ports?: readonly number[]; hosts?: readonly string[]; perAttemptTimeoutMs?: number },
): Promise<string[]> {
  const ports = options?.ports ?? AGENT_LOOPBACK_PORTS;
  const hosts = options?.hosts ?? AGENT_LOOPBACK_HOSTS;
  const timeoutMs = options?.perAttemptTimeoutMs ?? 400;
  const bases = hosts.flatMap((host) => ports.map((port) => `http://${host}:${port}`));
  const answered = await Promise.all(
    bases.map(async (base) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return (await probeAgentBaseUrl(fetchFn, base, controller.signal)) ? base : null;
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  return answered.filter((base): base is string => base !== null);
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function randomChallenge(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Whether the program at `baseUrl` is the paired agent: it must sign a fresh random challenge
 * together with this page's `origin` and the port asked, with the private part of `agentKey`.
 * Only the challenge is sent.
 */
export async function verifyAgentIdentity(
  fetchFn: typeof fetch,
  baseUrl: string,
  agentKey: AgentPublicKey,
  origin: string,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const port = Number(new URL(baseUrl).port);
    const challenge = randomChallenge();
    const res = await fetchFn(`${baseUrl}/v1/identity`, {
      method: "POST",
      headers: { "x-vibefork": "1", "Content-Type": "application/json" },
      body: JSON.stringify({ challenge }),
      signal,
    });
    if (!res.ok) return false;
    const proof = (await res.json()) as Partial<IdentityResponse>;
    if (proof.port !== port || typeof proof.signature !== "string") return false;
    if (proof.agentKey?.x !== agentKey.x || proof.agentKey?.y !== agentKey.y) return false;
    const signature = base64UrlToBytes(proof.signature);
    if (!signature || signature.length !== 64) return false;
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", x: agentKey.x, y: agentKey.y, ext: true },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const statement = `${AGENT_IDENTITY_CONTEXT}\n${origin}\n${port}\n${challenge}`;
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      signature,
      new TextEncoder().encode(statement),
    );
  } catch {
    return false;
  }
}

/**
 * The agent to talk to. With a paired `agentKey`: the first port, in port order, whose program
 * proves it holds that key (all five are checked); none → {@link AgentNotVerifiedError} when something
 * answers. Without a key (pairing): the only answering port; two or more → {@link AgentConflictError}.
 * `null`: nothing answers.
 */
export async function discoverTrustedAgent(
  fetchFn: typeof fetch,
  options: {
    agentKey: AgentPublicKey | null;
    origin: string;
    ports?: readonly number[];
    hosts?: readonly string[];
    perAttemptTimeoutMs?: number;
  },
): Promise<string | null> {
  const answering = await findAnsweringAgents(fetchFn, options);
  if (answering.length === 0) return null;
  const { agentKey } = options;
  if (!agentKey) {
    if (answering.length > 1) throw new AgentConflictError();
    return answering[0];
  }
  const verified = await Promise.all(
    answering.map((base) => verifyAgentIdentity(fetchFn, base, agentKey, options.origin)),
  );
  const index = verified.indexOf(true);
  if (index < 0) throw new AgentNotVerifiedError();
  return answering[index];
}

/** Backoff schedule in ms: 1s, 2s, 4s, 8s, then cap at 30s. */
export function reconnectDelayMs(attempt: number): number {
  const base = 1000 * 2 ** Math.max(0, attempt);
  return Math.min(base, 30_000);
}
