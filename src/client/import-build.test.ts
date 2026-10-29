import { describe, expect, it, vi } from "vitest";
import { createAgentTransport } from "./create-agent-transport.ts";
import { buildLogLine } from "../pages/OpenPage.tsx";
import { loadLocale, useI18nStore } from "../i18n/i18nStore.ts";
import type { BuildMessage } from "./types.ts";

const BASE = "http://127.0.0.1:47801";

class AgentSocket {
  static OPEN = 1;
  static last: AgentSocket | null = null;
  static script: Record<string, unknown>[] = [];
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    AgentSocket.last = this;
    queueMicrotask(() => {
      this.readyState = AgentSocket.OPEN;
      this.onopen?.();
    });
  }

  send(data: string): void {
    const msg = JSON.parse(data) as Record<string, unknown>;
    this.sent.push(msg);
    if (msg.type === "auth") queueMicrotask(() => this.emit({ type: "authed", keyId: "k" }));
    if (msg.type === "build" || msg.type === "task") {
      for (const m of AgentSocket.script) queueMicrotask(() => this.emit(m));
    }
  }

  emit(m: Record<string, unknown>): void {
    this.onmessage?.({ data: JSON.stringify(m) });
  }

  close(): void {
    this.readyState = 3;
  }
}

function transportWithSession(fetchImpl: typeof fetch) {
  const transport = createAgentTransport({
    baseUrl: BASE,
    discover: false,
    fetch: fetchImpl,
    WebSocket: AgentSocket as unknown as typeof WebSocket,
    getKeyId: async () => "k",
    signNonce: async () => "sig",
  });
  return transport;
}

function sessionFetch(extra?: (url: string, init?: RequestInit) => Response | undefined) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const hit = extra?.(url, init);
    if (hit) return hit;
    if (url.endsWith("/v1/auth/challenge")) return new Response(JSON.stringify({ nonce: "n" }));
    if (url.endsWith("/v1/auth/session")) return new Response(JSON.stringify({ token: "tok" }));
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
}

describe("importProject", () => {
  it("posts repo, ref and upstream to the agent and returns the foreign summary", async () => {
    let body: unknown = null;
    const fetchImpl = sessionFetch((url, init) => {
      if (url.endsWith("/v1/projects/import")) {
        body = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            project: "demo",
            upstream: "o/r",
            commit: "abc",
            foreign: { source: "o/r@pull/7/head", files: 2, dependencies: ["package.json"], buildScripts: [], binaries: [], complete: true, compareUrl: "u" },
          }),
        );
      }
      return undefined;
    });
    const t = transportWithSession(fetchImpl);
    const r = await t.importProject({ repo: "o/r", ref: "pull/7/head", upstream: "o/r" });
    expect(body).toEqual({ repo: "o/r", ref: "pull/7/head", upstream: "o/r" });
    expect(r.foreign?.dependencies).toEqual(["package.json"]);
  });

  it("surfaces the agent's error text", async () => {
    const fetchImpl = sessionFetch((url) =>
      url.endsWith("/v1/projects/import")
        ? new Response(JSON.stringify({ error: "not a branch, tag, commit or pull/<N>/head" }), { status: 400 })
        : undefined,
    );
    await expect(transportWithSession(fetchImpl).importProject({ repo: "o/r", ref: "a b" })).rejects.toThrow(
      "not a branch",
    );
  });
});

describe("runBuild", () => {
  it("authenticates, asks to build, streams messages and ends on build_done", async () => {
    AgentSocket.script = [
      { type: "estimate", verdict: "ok", text: "fits" },
      { type: "build_log", text: "compiling" },
      { type: "build_done", code: 0, artifacts: "C:/out", files: ["app.exe"], seconds: 3 },
    ];
    const t = transportWithSession(sessionFetch());
    await t.authenticateSession({} as CryptoKey);
    const seen: string[] = [];
    const outcome = await t.runBuild("demo", (m) => seen.push(m.type));
    expect(AgentSocket.last?.sent).toEqual([
      { type: "auth", token: "tok" },
      { type: "build", project: "demo" },
    ]);
    expect(seen).toEqual(["estimate", "build_log", "build_done"]);
    expect(outcome).toEqual({ kind: "done", code: 0, artifacts: "C:/out", files: ["app.exe"] });
  });

  it("ends with the agent's error (e.g. the build was not confirmed)", async () => {
    AgentSocket.script = [{ type: "error", error: "build not confirmed" }];
    const t = transportWithSession(sessionFetch());
    await t.authenticateSession({} as CryptoKey);
    expect(await t.runBuild("demo", () => {})).toEqual({ kind: "error", error: "build not confirmed" });
  });

  it("needs a session", async () => {
    await expect(transportWithSession(sessionFetch()).runBuild("demo", () => {})).rejects.toThrow("no session");
  });
});

describe("buildLogLine", () => {
  it("shows build output, estimates and toolchain steps; skips the rest", () => {
    const line = (m: Record<string, unknown>) => buildLogLine(m as BuildMessage);
    expect(line({ type: "build_log", text: "ok" })).toBe("ok");
    expect(line({ type: "toolchain", tool: "java@21", status: "failed", error: "no space" })).toBe(
      "java@21: failed — no space",
    );
    expect(line({ type: "build_done", code: 0 })).toBeNull();
  });

  it("words a tool that was not installed by its code in the person's language", async () => {
    const line = (m: Record<string, unknown>) => buildLogLine(m as BuildMessage);
    const failed = { type: "toolchain", tool: "java@21", status: "failed", error: "timed out", code: "timed_out" };
    await loadLocale("de");
    useI18nStore.getState().setLocale("de");
    expect(line(failed)).toBe("Die Installation von java@21 hat zu lange gedauert und wurde gestoppt");
    useI18nStore.getState().setLocale("en");
    expect(line(failed)).toBe("Installing java@21 took too long and was stopped");
  });
});

describe("projects", () => {
  const list = {
    root: "/p",
    projects: ["app", "app-2", "other"],
    details: [
      { name: "app", source: "Owner/App", commit: "a" },
      { name: "app-2", source: "fork/app", original: "owner/app", commit: "b" },
      { name: "other", source: "x/y" },
    ],
  };
  const fetchImpl = sessionFetch((url, init) => {
    if (url.endsWith("/v1/projects")) return new Response(JSON.stringify(list));
    if (url.endsWith("/v1/projects/import")) {
      const body = JSON.parse(String(init?.body)) as { repo: string; ref?: string };
      return new Response(JSON.stringify({ project: "new", upstream: body.repo, commit: "c" }));
    }
    return undefined;
  });

  it("finds projects taken from a repository or from a fork of it", async () => {
    const t = transportWithSession(fetchImpl);
    expect(await t.findProjectsByUpstream("owner/app")).toEqual([{ projectId: "app" }, { projectId: "app-2" }]);
  });

  it("clones through the agent's import", async () => {
    const t = transportWithSession(fetchImpl);
    expect(await t.cloneProject({ upstream: "owner/app", ref: "main" })).toEqual({ projectId: "new" });
  });
});

describe("runTask", () => {
  it("sends the task in the agent's format and ends on done", async () => {
    AgentSocket.script = [
      { type: "started", project: "demo", provider: "claude", model: "s", resume: false, handoff: false, toolchain: [] },
      { type: "evt", provider: "claude", ev: { kind: "text", text: "ok" } },
      { type: "done", code: 0, diff: "d", status: "1 file changed", commit: "abc" },
    ];
    const t = transportWithSession(sessionFetch());
    await t.authenticateSession({} as CryptoKey);
    const seen: string[] = [];
    const outcome = await t.runTask({ projectId: "demo", prompt: "fix it" }, (m) => seen.push(m.type));
    expect(AgentSocket.last?.sent[1]).toEqual({
      type: "task",
      project: "demo",
      prompt: "fix it",
      provider: null,
      model: null,
      continue: false,
      lang: null,
    });
    expect(seen).toEqual(["started", "evt", "done"]);
    expect(outcome).toEqual({ kind: "done", code: 0, status: "1 file changed", commit: "abc" });
  });

  it("passes interface language code in task message", async () => {
    AgentSocket.script = [
      { type: "started", project: "demo", provider: "claude", model: "s", resume: false, handoff: false, toolchain: [] },
      { type: "done", code: 0, diff: "", status: "", commit: "abc" },
    ];
    const t = transportWithSession(sessionFetch());
    await t.authenticateSession({} as CryptoKey);
    await t.runTask({ projectId: "demo", prompt: "fix it", lang: "ru" }, () => {});
    expect(AgentSocket.last?.sent[1]).toEqual({
      type: "task",
      project: "demo",
      prompt: "fix it",
      provider: null,
      model: null,
      continue: false,
      lang: "ru",
    });
  });
});

describe("connectGithub", () => {
  it("posts JSON with the agent header (the agent's guard refuses a POST without it)", async () => {
    let headers: Headers | null = null;
    const fetchImpl = sessionFetch((url, init) => {
      if (url.endsWith("/v1/github/connect")) {
        headers = new Headers(init?.headers);
        return new Response(JSON.stringify({ userCode: "ABCD-1234", verificationUri: "https://github.com/login/device", expiresIn: 900 }));
      }
      return undefined;
    });
    const r = await transportWithSession(fetchImpl).connectGithub();
    expect(r.userCode).toBe("ABCD-1234");
    expect(headers!.get("Content-Type")).toBe("application/json");
    expect(headers!.get("x-vibefork")).toBe("1");
  });
});
