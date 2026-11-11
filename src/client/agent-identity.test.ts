import { describe, expect, it } from "vitest";
import {
  AGENT_LOOPBACK_PORTS,
  AgentConflictError,
  AgentNotVerifiedError,
  discoverTrustedAgent,
  verifyAgentIdentity,
  type AgentPublicKey,
} from "./agent-base-url.ts";
import { createAgentTransport } from "./create-agent-transport.ts";

const ORIGIN = "https://editor.test";

/** An agent's key pair, as the agent keeps it. */
async function agentKeys(): Promise<{ privateKey: CryptoKey; publicKey: AgentPublicKey }> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { privateKey: pair.privateKey, publicKey: { kty: "EC", crv: "P-256", x: jwk.x!, y: jwk.y! } };
}

function toBase64Url(buffer: ArrayBuffer): string {
  let binary = "";
  for (const b of new Uint8Array(buffer)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** What `POST /v1/identity` of an agent with `keys` on `port` answers to `challenge` from `origin`. */
async function proof(keys: Awaited<ReturnType<typeof agentKeys>>, origin: string, port: number, challenge: string) {
  const statement = `vibefork-agent-identity-v1\n${origin}\n${port}\n${challenge}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keys.privateKey,
    new TextEncoder().encode(statement),
  );
  return { agentKey: keys.publicKey, port, signature: toBase64Url(signature) };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

type Program = (path: string, init: RequestInit | undefined) => Promise<Response>;

/** A loopback with a program on some ports; records every request each port got. */
function loopback(programs: Record<number, Program>) {
  const seen: { port: number; path: string; body?: string }[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const port = Number(url.port);
    seen.push({ port, path: url.pathname, body: typeof init?.body === "string" ? init.body : undefined });
    const program = programs[port];
    if (!program) throw new TypeError("connection refused");
    return program(url.pathname, init);
  }) as typeof fetch;
  return { fetchFn, seen };
}

const hello = () => json({ agent: "vibefork", platform: "test", version: "1" });

/** A real agent with `keys` listening on `port`. */
function agent(keys: Awaited<ReturnType<typeof agentKeys>>, port: number, origin = ORIGIN): Program {
  return async (path, init) => {
    if (path === "/v1/hello") return hello();
    if (path === "/v1/identity") {
      const { challenge } = JSON.parse(String(init?.body)) as { challenge: string };
      return json(await proof(keys, origin, port, challenge));
    }
    return json({ ok: true });
  };
}

describe("verifyAgentIdentity", () => {
  it("accepts the paired agent and sends it only a fresh challenge", async () => {
    const keys = await agentKeys();
    const { fetchFn, seen } = loopback({ 47802: agent(keys, 47802) });

    expect(await verifyAgentIdentity(fetchFn, "http://127.0.0.1:47802", keys.publicKey, ORIGIN)).toBe(true);
    expect(await verifyAgentIdentity(fetchFn, "http://127.0.0.1:47802", keys.publicKey, ORIGIN)).toBe(true);
    const bodies = seen.map((s) => JSON.parse(s.body!) as Record<string, string>);
    expect(bodies.every((b) => Object.keys(b).join() === "challenge")).toBe(true);
    expect(bodies[0].challenge).not.toBe(bodies[1].challenge);
    expect(bodies[0].challenge.length).toBeGreaterThanOrEqual(22);
  });

  it("rejects another key, another origin, a proof for another port and a broken signature", async () => {
    const paired = await agentKeys();
    const other = await agentKeys();
    const base = "http://127.0.0.1:47801";
    const cases: Program[] = [
      agent(other, 47801),
      agent(paired, 47801, "https://evil.test"),
      agent(paired, 47802),
      async (path, init) => {
        const { challenge } = JSON.parse(String(init?.body)) as { challenge: string };
        const p = await proof(other, ORIGIN, 47801, challenge);
        return path === "/v1/identity" ? json({ ...p, agentKey: paired.publicKey }) : hello();
      },
      async () => json({ agentKey: paired.publicKey, port: 47801, signature: "AAAA" }),
      async () => new Response("not found", { status: 404 }),
    ];
    for (const program of cases) {
      const { fetchFn } = loopback({ 47801: program });
      expect(await verifyAgentIdentity(fetchFn, base, paired.publicKey, ORIGIN)).toBe(false);
    }
  });
});

describe("discoverTrustedAgent", () => {
  it("skips a program that took the first port and finds the paired agent on a later one", async () => {
    const paired = await agentKeys();
    const squatter = await agentKeys();
    const { fetchFn, seen } = loopback({ 47801: agent(squatter, 47801), 47804: agent(paired, 47804) });

    const base = await discoverTrustedAgent(fetchFn, { agentKey: paired.publicKey, origin: ORIGIN });

    expect(base).toBe("http://127.0.0.1:47804");
    const helloPorts = seen.filter((s) => s.path === "/v1/hello").map((s) => s.port);
    expect([...helloPorts].sort()).toEqual([...AGENT_LOOPBACK_PORTS]);
  });

  it("rejects a program that relays the real agent's proof from another port", async () => {
    const paired = await agentKeys();
    const real = agent(paired, 47802);
    const relay: Program = (path, init) => real(path, init); // forwards everything to 47802
    const { fetchFn } = loopback({ 47801: relay, 47802: real });

    const base = await discoverTrustedAgent(fetchFn, { agentKey: paired.publicKey, origin: ORIGIN });

    expect(base).toBe("http://127.0.0.1:47802");
  });

  it("reports when only programs without the paired key answer", async () => {
    const paired = await agentKeys();
    const { fetchFn } = loopback({ 47801: agent(await agentKeys(), 47801) });

    await expect(discoverTrustedAgent(fetchFn, { agentKey: paired.publicKey, origin: ORIGIN })).rejects.toBeInstanceOf(
      AgentNotVerifiedError,
    );
    expect(await discoverTrustedAgent(loopback({}).fetchFn, { agentKey: paired.publicKey, origin: ORIGIN })).toBeNull();
  });

  it("does not choose between two answering programs when nothing is paired yet", async () => {
    const one = loopback({ 47802: agent(await agentKeys(), 47802) });
    expect(await discoverTrustedAgent(one.fetchFn, { agentKey: null, origin: ORIGIN })).toBe("http://127.0.0.1:47802");

    const two = loopback({ 47801: agent(await agentKeys(), 47801), 47802: agent(await agentKeys(), 47802) });
    await expect(discoverTrustedAgent(two.fetchFn, { agentKey: null, origin: ORIGIN })).rejects.toBeInstanceOf(
      AgentConflictError,
    );
  });
});

describe("transport and a program on the agent's port", () => {
  it("sends the program nothing but hello and the identity challenge", async () => {
    const paired = await agentKeys();
    const { fetchFn, seen } = loopback({ 47801: agent(await agentKeys(), 47801), 47802: agent(paired, 47802) });
    const client = createAgentTransport({
      discover: true,
      fetch: fetchFn,
      origin: ORIGIN,
      getAgentKey: async () => paired.publicKey,
      getKeyId: async () => "browser-key",
      signNonce: async () => "signature",
    });

    await client.listProjects().catch(() => undefined);
    await client.getProject("demo").catch(() => undefined);

    const toSquatter = seen.filter((s) => s.port === 47801).map((s) => s.path);
    expect(new Set(toSquatter)).toEqual(new Set(["/v1/hello", "/v1/identity"]));
    expect(seen.some((s) => s.port === 47802 && s.path === "/v1/projects")).toBe(true);
  });
});
