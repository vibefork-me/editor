import { describe, expect, it, vi } from "vitest";
import {
  AGENT_LOOPBACK_PORTS,
  discoverAgentBaseUrl,
  reconnectDelayMs,
} from "./agent-base-url.ts";
import { createAgentTransport } from "./create-agent-transport.ts";
import type { GraphSnapshot } from "./types.ts";

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
    if (msg.type === "task_start" && typeof msg.requestId === "string") {
      queueMicrotask(() => {
        this.emit({
          type: "task_accepted",
          requestId: msg.requestId,
          taskId: "task-1",
          state: "queued",
          lastEventId: 0,
        });
      });
    }
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

  it("replays project and task streams with independent cursors", async () => {
    let ws: MockWebSocket | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      if (String(input).endsWith("/v1/hello")) {
        return jsonResponse({ agent: "vf", platform: "test", version: "0" });
      }
      return jsonResponse({ token: "t", expiresIn: 900 });
    });

    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
      WebSocket: class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          ws = this;
        }
      } as unknown as typeof WebSocket,
      getKeyId: async () => "k",
      signNonce: async () => "s",
    });
    await client.authenticateSession({} as CryptoKey);

    const snapshots: GraphSnapshot[] = [];
    const events: number[] = [];
    client.subscribeProjectResearch({
      projectId: "demo",
      afterCursor: "cur-9",
      onSnapshot: (s) => snapshots.push(s),
      onGap: () => {},
    });
    client.subscribeTask({
      taskId: "task-1",
      afterEventId: 42,
      onEvent: (ev) => events.push(ev.eventId),
      onGap: () => {},
    });

    await vi.waitFor(() => expect(ws?.sent.length).toBeGreaterThan(0));
    const projectSub = JSON.parse(
      ws!.sent.find((s) => JSON.parse(s).type === "project_research_subscribe")!,
    ) as { afterCursor?: string };
    const taskSub = JSON.parse(
      ws!.sent.find((s) => JSON.parse(s).type === "task_subscribe")!,
    ) as { afterEventId?: number };
    expect(projectSub.afterCursor).toBe("cur-9");
    expect(taskSub.afterEventId).toBe(42);

    ws!.emit({
      type: "project_event",
      project: "demo",
      cursor: "cur-10",
      eventType: "graph_update",
      data: { revision: 1, nodes: [], edges: [], focus: null, phase: "exploring" },
    });
    ws!.emit({
      type: "task_event",
      taskId: "task-1",
      eventId: 43,
      at: "2026-01-01T00:00:00Z",
      eventType: "step_started",
      data: {},
    });

    expect(snapshots).toHaveLength(1);
    expect(events).toEqual([43]);
  });

  it("resets project buffer on replay_gap and resubscribes without cursor", async () => {
    let ws: MockWebSocket | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      if (String(input).endsWith("/v1/hello")) {
        return jsonResponse({ agent: "vf", platform: "test", version: "0" });
      }
      return jsonResponse({ token: "t", expiresIn: 900 });
    });

    const gaps: number[] = [];
    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47801",
      fetch: fetchMock as typeof fetch,
      WebSocket: class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          ws = this;
        }
      } as unknown as typeof WebSocket,
      getKeyId: async () => "k",
      signNonce: async () => "s",
    });
    await client.authenticateSession({} as CryptoKey);

    client.subscribeProjectResearch({
      projectId: "demo",
      afterCursor: "stale",
      onSnapshot: () => {},
      onGap: () => gaps.push(1),
    });

    await vi.waitFor(() => expect(ws?.sent.length).toBeGreaterThan(0));
    const before = ws!.sent.length;
    ws!.emit({ type: "replay_gap", project: "demo" });
    await vi.waitFor(() => expect(ws!.sent.length).toBeGreaterThan(before));

    const lastProjectSub = [...ws!.sent]
      .map((s) => JSON.parse(s) as { type: string; afterCursor?: string })
      .filter((m) => m.type === "project_research_subscribe")
      .at(-1);
    expect(gaps).toHaveLength(1);
    expect(lastProjectSub?.afterCursor).toBeUndefined();
  });

  it("schedules reconnect after health polling when socket drops", async () => {
    vi.useFakeTimers();
    let ws: MockWebSocket | null = null;
    const healthChecks: string[] = [];
    const scheduled: number[] = [];

    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/v1/hello")) {
        healthChecks.push(url);
        return jsonResponse({ agent: "vf", platform: "test", version: "0" });
      }
      if (url.endsWith("/v1/auth/challenge")) return jsonResponse({ nonce: "n" });
      if (url.endsWith("/v1/auth/session")) return jsonResponse({ token: "t", expiresIn: 900 });
      return new Response("not found", { status: 404 });
    });

    const client = createAgentTransport({
      baseUrl: "http://127.0.0.1:47802",
      fetch: fetchMock as typeof fetch,
      WebSocket: class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          ws = this;
        }
      } as unknown as typeof WebSocket,
      getKeyId: async () => "k",
      signNonce: async () => "s",
      schedule: (fn, ms) => {
        scheduled.push(ms);
        return setTimeout(fn, ms) as unknown as number;
      },
      clearSchedule: (id) => clearTimeout(id),
    });

    await client.authenticateSession({} as CryptoKey);
    client.subscribeProjectResearch({
      projectId: "demo",
      onSnapshot: () => {},
      onGap: () => {},
    });
    await vi.waitFor(() => expect(ws).not.toBeNull());
    ws!.close();

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.resolve();
    expect(scheduled[0]).toBe(1000);
    expect(healthChecks.length).toBeGreaterThanOrEqual(1);
    vi.useRealTimers();
  });
});
