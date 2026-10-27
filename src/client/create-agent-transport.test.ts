import { describe, expect, it, vi } from "vitest";
import {
  AGENT_LOOPBACK_PORTS,
  discoverAgentBaseUrl,
  reconnectDelayMs,
} from "./agent-base-url.ts";
import { createAgentTransport } from "./create-agent-transport.ts";
import type { TaskControl } from "./types.ts";

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = 0;
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    });
  }

  send(data: string): void {
    this.sent.push(data);
    const msg = JSON.parse(data) as Record<string, unknown>;
    if (msg.type === "graph_focus" && typeof msg.requestId === "string") {
      queueMicrotask(() => {
        this.emit({
          type: "graph_focus_result",
          requestId: msg.requestId,
          accepted: true,
        });
      });
    }
  }

  emit(payload: Record<string, unknown>): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("agent-client transport", () => {
  it("completes challenge-auth handshake and keeps token in closure", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/v1/hello")) return jsonResponse({ agent: "vf", platform: "test", version: "0" });
      if (url.endsWith("/v1/auth/challenge")) {
        expect(init?.method).toBe("POST");
        return jsonResponse({ nonce: "nonce-abc" });
      }
      if (url.endsWith("/v1/auth/session")) {
        const body = JSON.parse(String(init?.body)) as { signature: string };
        expect(body.signature).toBe("sig-test");
        return jsonResponse({ token: "session-token", expiresIn: 900 });
      }
      if (url.endsWith("/v1/models")) {
        expect(init?.headers && new Headers(init.headers).get("Authorization")).toBe(
          "Bearer session-token",
        );
        return jsonResponse({ models: [] });
      }
      return new Response("not found", { status: 404 });
    });

    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
      getKeyId: async () => "key-1",
      signNonce: async () => "sig-test",
    });

    const { token } = await client.authenticateSession({} as CryptoKey);
    expect(token).toBe("session-token");
    await client.getModels();
    expect(calls.some((u) => u.includes("/v1/auth/challenge"))).toBe(true);
    expect(calls.some((u) => u.includes("/v1/auth/session"))).toBe(true);
  });

  it("uses exponential backoff delays capped at 30s", () => {
    expect(reconnectDelayMs(0)).toBe(1000);
    expect(reconnectDelayMs(1)).toBe(2000);
    expect(reconnectDelayMs(2)).toBe(4000);
    expect(reconnectDelayMs(3)).toBe(8000);
    expect(reconnectDelayMs(4)).toBe(16000);
    expect(reconnectDelayMs(5)).toBe(30000);
    expect(reconnectDelayMs(10)).toBe(30000);
  });

  it("posts project saves to the protected save endpoint", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo, _init?: RequestInit) =>
      jsonResponse({
        step: "saved",
        url: "https://github.com/user/project",
        copy: "user/project",
        commit: "abc1234",
      })
    );
    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });

    const result = await client.saveProject({ projectId: "demo" });

    expect(result.step).toBe("saved");
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://127.0.0.1:47801/v1/save");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ project: "demo" });
  });

  it("starts pairing and polls for its approval", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/v1/pair/start")) {
        return jsonResponse({ pairId: "pair-1", code: "123-456" });
      }
      if (url.endsWith("/v1/pair/status?id=pair-1")) {
        return jsonResponse({ status: "approved", keyId: "key-1" });
      }
      return new Response("not found", { status: 404 });
    });
    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });

    const pairing = await client.startPairing({
      publicKeyJwk: { kty: "EC", crv: "P-256", x: "x", y: "y" },
      name: "Editor",
    });
    const status = await client.getPairingStatus(pairing.pairId);

    expect(pairing).toEqual({ pairId: "pair-1", code: "123-456" });
    expect(status).toEqual({ status: "approved", keyId: "key-1" });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      publicKeyJwk: { kty: "EC", crv: "P-256", x: "x", y: "y" },
      name: "Editor",
    });
  });

  it("probes loopback ports 47801 through 47805", async () => {
    const tried: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      tried.push(String(input));
      if (String(input).includes(":47803/v1/hello")) {
        return jsonResponse({ agent: "vf", platform: "test", version: "0" });
      }
      throw new Error("connection refused");
    });

    const base = await discoverAgentBaseUrl(fetchMock as typeof fetch, { perAttemptTimeoutMs: 50 });
    expect(base).toBe("http://127.0.0.1:47803");
    expect(AGENT_LOOPBACK_PORTS).toEqual([47801, 47802, 47803, 47804, 47805]);
    expect(tried.map((u) => new URL(u).port)).toEqual(["47801", "47802", "47803"]);
  });

  it("fetches graph snapshot from /v1/graph and supports view=folders", async () => {
    const urls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith("/v1/hello")) {
        return jsonResponse({ agent: "vf", platform: "test", version: "0" });
      }
      if (url.includes("/v1/graph?project=demo&view=folders")) {
        return jsonResponse({
          source: "folders",
          revision: "rev-folders",
          nodes: [{ id: "src", label: "src", files: 10, changed: 2 }],
          edges: [],
        });
      }
      if (url.includes("/v1/graph?project=demo")) {
        return jsonResponse({
          source: "model",
          revision: "rev-model",
          nodes: [{ id: "p1", label: "Core", files: 5, changed: 1, summary: "Main logic" }],
          edges: [],
        });
      }
      return new Response("not found", { status: 404 });
    });

    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
    });

    const defaultGraph = await client.getGraph("demo");
    expect(defaultGraph.source).toBe("model");
    expect(defaultGraph.nodes[0]?.label).toBe("Core");
    expect(urls.some((u) => u.includes("/v1/graph?project=demo"))).toBe(true);

    const folderGraph = await client.getGraph({ projectId: "demo", view: "folders" });
    expect(folderGraph.source).toBe("folders");
    expect(folderGraph.nodes[0]?.label).toBe("src");
    expect(urls.some((u) => u.includes("/v1/graph?project=demo&view=folders"))).toBe(true);
  });

  it("calls POST /v1/graph/describe with language code", async () => {
    let capturedBody: unknown = null;
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/hello")) {
        return jsonResponse({ agent: "vf", platform: "test", version: "0" });
      }
      if (url.endsWith("/v1/graph/describe") && init?.method === "POST") {
        capturedBody = JSON.parse(String(init.body));
        return jsonResponse({
          source: "model",
          revision: "rev-described",
          nodes: [{ id: "p1", label: "UI", files: 3, changed: 0, summary: "User interface" }],
          edges: [],
        });
      }
      return new Response("not found", { status: 404 });
    });

    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
    });

    const described = await client.describeGraph({ projectId: "demo", lang: "ru" });
    expect(described.source).toBe("model");
    expect(described.nodes[0]?.summary).toBe("User interface");
    expect(capturedBody).toEqual({ project: "demo", lang: "ru" });
  });

  it("propagates HTTP errors from getGraph and describeGraph", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/v1/hello")) {
        return jsonResponse({ agent: "vf", platform: "test", version: "0" });
      }
      if (url.includes("/v1/graph?project=missing")) {
        return jsonResponse({ error: "no such project" }, 404);
      }
      if (url.endsWith("/v1/graph/describe")) {
        return jsonResponse({ error: "model unavailable" }, 500);
      }
      return new Response("not found", { status: 404 });
    });

    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
    });

    await expect(client.getGraph("missing")).rejects.toThrow("no such project");
    await expect(client.describeGraph({ projectId: "missing" })).rejects.toThrow("model unavailable");
  });

  it("reads project file from /v1/file with project and path query parameters", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/v1/file?project=demo&path=src%2Fmain.rs")) {
        return jsonResponse({
          path: "src/main.rs",
          size: 15,
          tooLarge: false,
          binary: false,
          content: "fn main() {}",
        });
      }
      return new Response("not found", { status: 404 });
    });
    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });

    const file = await client.readFile({ projectId: "demo", path: "src/main.rs" });
    expect(file).toEqual({
      path: "src/main.rs",
      size: 15,
      tooLarge: false,
      binary: false,
      content: "fn main() {}",
    });
  });

  it("reads project diff from /v1/diff with project and path query parameters", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/v1/diff?project=demo&path=src%2Fmain.rs")) {
        return jsonResponse({
          path: "src/main.rs",
          base: "commit1",
          tooLarge: false,
          binary: false,
          original: "old",
          modified: "new",
        });
      }
      return new Response("not found", { status: 404 });
    });
    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });

    const diff = await client.readDiff({ projectId: "demo", path: "src/main.rs" });
    expect(diff).toEqual({
      path: "src/main.rs",
      base: "commit1",
      tooLarge: false,
      binary: false,
      original: "old",
      modified: "new",
    });
  });

  it("lists project files from /v1/files and reports a missing endpoint by status", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/v1/files?project=notes-app")) {
        return jsonResponse({ files: ["README.md", "src/list.ts"], truncated: false });
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    });
    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });

    expect(await client.listFiles("notes-app")).toEqual({ files: ["README.md", "src/list.ts"], truncated: false });
    await expect(client.listFiles("other")).rejects.toMatchObject({ status: 404 });
  });

  it("assertSafePath rejects path traversal and secret files before fetch", async () => {
    const fetchMock = vi.fn();
    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });

    await expect(client.readFile({ projectId: "demo", path: "../outside.txt" })).rejects.toThrow("invalid path");
    await expect(client.readFile({ projectId: "demo", path: "/etc/passwd" })).rejects.toThrow("invalid path");
    await expect(client.readFile({ projectId: "demo", path: ".env" })).rejects.toThrow("path denied");
    await expect(client.readDiff({ projectId: "demo", path: "../outside.txt" })).rejects.toThrow("invalid path");
    await expect(client.readDiff({ projectId: "demo", path: ".env" })).rejects.toThrow("path denied");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propagates HTTP 403 error status on forbidden files", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: "this file is not shown" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });

    try {
      await client.readFile({ projectId: "demo", path: "secret.key" });
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as { status?: number }).status).toBe(403);
      expect((err as Error).message).toBe("this file is not shown");
    }
  });

  it("fetches AI status from /v1/ai", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/v1/ai")) {
        return jsonResponse({
          ready: false,
          providers: [
            { id: "claude", kind: "subscription", installed: true, connected: "no" },
            { id: "codex", kind: "subscription", installed: true, connected: "no" },
            { id: "openrouter", kind: "free", installed: true, connected: "no" },
          ],
        });
      }
      return jsonResponse({});
    });
    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });
    const status = await client.getAiStatus();
    expect(status.ready).toBe(false);
    expect(status.providers).toHaveLength(3);
    expect(status.providers[0].id).toBe("claude");
  });

  it("posts AI connect to /v1/ai/connect", async () => {
    let requestBody: unknown;
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/v1/ai/connect")) {
        requestBody = JSON.parse(String(init?.body));
        return jsonResponse({ started: true });
      }
      return jsonResponse({});
    });
    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });
    const res = await client.connectAi("claude");
    expect(res.started).toBe(true);
    expect(requestBody).toEqual({ provider: "claude" });
  });
});

describe("task control", () => {
  /** An agent socket: answers auth, records what the editor sends. */
  class TaskSocket {
    static last: TaskSocket | null = null;
    sent: Record<string, unknown>[] = [];
    onopen: (() => void) | null = null;
    onmessage: ((ev: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() {
      TaskSocket.last = this;
      queueMicrotask(() => this.onopen?.());
    }
    send(data: string): void {
      const msg = JSON.parse(data) as Record<string, unknown>;
      this.sent.push(msg);
      if (msg.type === "auth") queueMicrotask(() => this.emit({ type: "authed", keyId: "key-1" }));
    }
    emit(payload: Record<string, unknown>): void {
      this.onmessage?.({ data: JSON.stringify(payload) });
    }
    close(): void {
      this.onclose?.();
    }
  }

  it("pauses, resumes and cancels a running task over its connection", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/v1/auth/challenge")) return jsonResponse({ nonce: "n" });
      if (url.endsWith("/v1/auth/session")) return jsonResponse({ token: "t", expiresIn: 900 });
      return jsonResponse({ agent: "vf", platform: "test", version: "0" });
    });
    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
      WebSocket: TaskSocket as unknown as typeof WebSocket,
      getKeyId: async () => "key-1",
      signNonce: async () => "sig",
    });
    await client.authenticateSession({} as CryptoKey);
    let control: TaskControl | null = null;
    const seen: string[] = [];
    const outcome = client.runTask({ projectId: "p", prompt: "x" }, (m) => seen.push(m.type), (c) => (control = c));
    await vi.waitFor(() => expect(control).not.toBeNull());
    const socket = TaskSocket.last!;
    control!.stop();
    socket.emit({ type: "paused" });
    control!.resume();
    socket.emit({ type: "resumed" });
    control!.stop();
    control!.cancel();
    socket.emit({ type: "cancelled" });
    await expect(outcome).resolves.toEqual({ kind: "cancelled" });
    expect(socket.sent.map((m) => m.type)).toEqual(["auth", "task", "stop", "resume", "stop", "cancel"]);
    expect(seen).toEqual(["paused", "resumed", "cancelled"]);
    // Nothing is sent after the task ended.
    control!.stop();
    expect(socket.sent).toHaveLength(6);
  });

  it("runs the program with run, streams its output and stops it with cancel", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/v1/auth/challenge")) return jsonResponse({ nonce: "n" });
      if (url.endsWith("/v1/auth/session")) return jsonResponse({ token: "t", expiresIn: 900 });
      return jsonResponse({ agent: "vf", platform: "test", version: "0" });
    });
    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
      WebSocket: TaskSocket as unknown as typeof WebSocket,
      getKeyId: async () => "key-1",
      signNonce: async () => "sig",
    });
    await client.authenticateSession({} as CryptoKey);
    let stop: (() => void) | null = null;
    const seen: string[] = [];
    const first = client.runProgram("notes-app", (m) => m.type === "program_log" && seen.push(`${m.stream}:${m.text}`), (s) => (stop = s));
    await vi.waitFor(() => expect(stop).not.toBeNull());
    let socket = TaskSocket.last!;
    socket.emit({ type: "program_log", stream: "stdout", text: "notes: 3" });
    socket.emit({ type: "program_log", stream: "stderr", text: "no config" });
    socket.emit({ type: "program_done", code: 1, cut: false, seconds: 0.5 });
    await expect(first).resolves.toEqual({ kind: "done", code: 1, cut: false });
    expect(seen).toEqual(["stdout:notes: 3", "stderr:no config"]);
    expect(socket.sent.map((m) => m.type)).toEqual(["auth", "run"]);

    stop = null;
    const second = client.runProgram("notes-app", () => {}, (s) => (stop = s));
    await vi.waitFor(() => expect(stop).not.toBeNull());
    socket = TaskSocket.last!;
    stop!();
    socket.emit({ type: "cancelled" });
    await expect(second).resolves.toEqual({ kind: "cancelled" });
    expect(socket.sent.map((m) => m.type)).toEqual(["auth", "run", "cancel"]);
  });

  it("sends a note over the task's connection; an agent without notes does not end the task", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/v1/auth/challenge")) return jsonResponse({ nonce: "n" });
      if (url.endsWith("/v1/auth/session")) return jsonResponse({ token: "t", expiresIn: 900 });
      return jsonResponse({ agent: "vf", platform: "test", version: "0" });
    });
    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
      WebSocket: TaskSocket as unknown as typeof WebSocket,
      getKeyId: async () => "key-1",
      signNonce: async () => "sig",
    });
    await client.authenticateSession({} as CryptoKey);
    let control: TaskControl | null = null;
    const seen: string[] = [];
    const outcome = client.runTask({ projectId: "p", prompt: "x" }, (m) => seen.push(m.type), (c) => (control = c));
    await vi.waitFor(() => expect(control).not.toBeNull());
    const socket = TaskSocket.last!;
    control!.note("keep the toggle", [{ name: "pasted.txt", mime: "text/plain", data: "aGk=" }]);
    expect(socket.sent[2]).toEqual({
      type: "note",
      project: "p",
      text: "keep the toggle",
      attachments: [{ name: "pasted.txt", mime: "text/plain", data: "aGk=" }],
    });
    socket.emit({ type: "error", error: "not supported by this version of the agent", code: "not_supported" });
    socket.emit({ type: "done", code: 0, status: "ok", diff: "" });
    await expect(outcome).resolves.toMatchObject({ kind: "done", code: 0 });
    expect(seen).toEqual(["error", "done"]);
  });

  async function taskClient() {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/v1/auth/challenge")) return jsonResponse({ nonce: "n" });
      if (url.endsWith("/v1/auth/session")) return jsonResponse({ token: "t", expiresIn: 900 });
      return jsonResponse({ agent: "vf", platform: "test", version: "0" });
    });
    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
      WebSocket: TaskSocket as unknown as typeof WebSocket,
      getKeyId: async () => "key-1",
      signNonce: async () => "sig",
    });
    await client.authenticateSession({} as CryptoKey);
    return client;
  }

  it("runs the task of an offer with choose_offer; notes go to it like to any task", async () => {
    const client = await taskClient();
    let control: TaskControl | null = null;
    const outcome = client.runOffer({ projectId: "p", index: 2, title: "Faster search", lang: "en" }, () => {}, (c) => (control = c));
    await vi.waitFor(() => expect(control).not.toBeNull());
    const socket = TaskSocket.last!;
    expect(socket.sent[1]).toEqual({
      type: "choose_offer",
      project: "p",
      index: 2,
      title: "Faster search",
      provider: null,
      model: null,
      continue: false,
      lang: "en",
    });
    socket.emit({ type: "planning" });
    control!.note("keep it simple");
    expect(socket.sent[2]).toMatchObject({ type: "note", project: "p", text: "keep it simple" });
    // Once the task runs, `not_supported` answers a note, not the task.
    socket.emit({ type: "error", error: "not supported by this version of the agent", code: "not_supported" });
    socket.emit({ type: "done", code: 0, status: "ok", diff: "" });
    await expect(outcome).resolves.toMatchObject({ kind: "done", code: 0 });
  });

  it("ends the offer's session when the agent does not know it or the offer is gone", async () => {
    const client = await taskClient();
    for (const code of ["not_supported", "bad_index"]) {
      const outcome = client.runOffer({ projectId: "p", index: 0 }, () => {});
      await vi.waitFor(() => expect(TaskSocket.last?.sent.map((m) => m.type)).toEqual(["auth", "choose_offer"]));
      TaskSocket.last!.emit({ type: "error", error: "no", code });
      await expect(outcome).resolves.toEqual({ kind: "error", error: "no", code });
      TaskSocket.last = null;
    }
  });
});
