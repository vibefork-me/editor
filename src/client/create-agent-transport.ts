import {
  discoverAgentBaseUrl,
  fetchAgentHello,
  probeAgentBaseUrl,
  reconnectDelayMs,
  resolveAgentBaseUrlFromLocation,
} from "./agent-base-url.ts";
import {
  AgentApiError,
  type AgentHealth,
  type AgentTransport,
  type BuildMessage,
  type CanvasResponse,
  type BuildOutcome,
  type DescribeRequest,
  type GraphResponse,
  type ImportProjectRequest,
  type ImportProjectResult,
  type ModelInfo,
  type PairStartResult,
  type PairStatusResult,
  type ProgramOutcome,
  type ProjectMetadata,
  type RollbackPartOutcome,
  type SaveProjectResult,
  type TaskControl,
} from "./types.ts";
import { notifyWsConnection } from "./ws-connection-bridge.ts";
import type {
  AiConnectRequest,
  AiConnectResponse,
  AiDisconnectRequest,
  AiDisconnectResponse,
  AiResponse,
  CliHomeMode,
  ClientMessage,
  FileDiffResponse,
  FileResponse,
  GithubConnectResponse,
  GithubStatusResponse,
  JournalResponse,
  ProjectFilesResponse,
  ProjectsResponse,
  RollbackRequest,
  RollbackResponse,
  ServerMessage,
} from "./protocol.generated.ts";
import type { TaskOutcome } from "./task-feed.ts";

const SECRET_PATH_DENY = /(?:^|\/)(?:\.env|id_rsa|credentials\.json|\.pem)(?:$|\/)/i;

export type AgentTransportDeps = {
  baseUrl?: string;
  discover?: boolean;
  fetch?: typeof fetch;
  WebSocket?: typeof WebSocket;
  getKeyId?: (clientKey: CryptoKey) => Promise<string>;
  signNonce?: (clientKey: CryptoKey, nonce: string) => Promise<string>;
  schedule?: (fn: () => void, delayMs: number) => number;
  clearSchedule?: (id: number) => void;
  location?: Pick<Location, "origin" | "pathname">;
};

function assertSafePath(path: string): void {
  if (path.includes("..") || path.startsWith("/") || /[\0\r\n]/.test(path)) {
    throw new Error("invalid path");
  }
  if (SECRET_PATH_DENY.test(path)) {
    throw new Error("path denied");
  }
}

export function createAgentTransport(deps: AgentTransportDeps = {}): AgentTransport {
  const fetchFn = deps.fetch ?? fetch.bind(globalThis);
  const WS = deps.WebSocket ?? WebSocket;
  const schedule =
    deps.schedule ?? ((fn, ms) => globalThis.setTimeout(fn, ms) as unknown as number);

  let baseUrl = deps.baseUrl ?? "";
  let bearerToken: string | null = null;
  let ws: WebSocket | null = null;
  let reconnectAttempt = 0;
  let intentionalClose = false;

  async function ensureBaseUrl(): Promise<string> {
    if (baseUrl) return baseUrl;
    const fromLocation = deps.location ? resolveAgentBaseUrlFromLocation(deps.location) : null;
    if (fromLocation) {
      baseUrl = fromLocation;
      return baseUrl;
    }
    if (deps.discover) {
      const found = await discoverAgentBaseUrl(fetchFn);
      if (found) {
        baseUrl = found;
        return baseUrl;
      }
    }
    throw new Error("agent base URL is not configured");
  }

  async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const base = await ensureBaseUrl();
    const headers = new Headers(init.headers);
    headers.set("x-vibefork", "1");
    if (bearerToken) {
      headers.set("Authorization", `Bearer ${bearerToken}`);
    }
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return fetchFn(`${base}${path}`, { ...init, headers });
  }

  function sendWs(payload: Record<string, unknown>): boolean {
    if (!ws || ws.readyState !== WS.OPEN) {
      return false;
    }
    ws.send(JSON.stringify(payload));
    return true;
  }

  function wsAuth(): void {
    if (!bearerToken || !ws || ws.readyState !== WS.OPEN) return;
    if (!sendWs({ type: "auth", token: bearerToken })) scheduleReconnect();
  }

  function scheduleReconnect(): void {
    if (intentionalClose) return;
    const delay = reconnectDelayMs(reconnectAttempt);
    reconnectAttempt += 1;
    schedule(async () => {
      const base = await ensureBaseUrl().catch(() => null);
      if (!base) {
        scheduleReconnect();
        return;
      }
      const healthy = await probeAgentBaseUrl(fetchFn, base);
      if (!healthy) {
        scheduleReconnect();
        return;
      }
      await connectWs();
    }, delay);
  }

  function connectWs(): Promise<void> {
    return new Promise((resolve, reject) => {
      ensureBaseUrl()
        .then((base) => {
          const url = `${base.replace(/^http/, "ws")}/v1/ws`;
          if (ws) {
            intentionalClose = true;
            ws.close();
            ws = null;
          }
          intentionalClose = false;
          ws = new WS(url);
          ws.onopen = () => {
            reconnectAttempt = 0;
            notifyWsConnection("open");
            wsAuth();
            resolve();
          };
          ws.onmessage = () => {};
          ws.onerror = () => reject(new Error("WebSocket error"));
          ws.onclose = () => {
            ws = null;
            if (!intentionalClose) {
              notifyWsConnection("closed-reconnecting");
              scheduleReconnect();
            }
          };
        })
        .catch(reject);
    });
  }

  async function fetchProjects(): Promise<ProjectsResponse> {
    const res = await apiFetch("/v1/projects");
    if (!res.ok) throw new Error("list projects failed");
    return (await res.json()) as ProjectsResponse;
  }

  /**
   * A WebSocket of its own speaking the agent's message set: `auth` → `authed` → `start` → messages
   * until `ends` returns an outcome. The agent runs one task or build per connection.
   */
  function agentSession<T>(
    start: ClientMessage,
    onMessage: (m: ServerMessage) => void,
    ends: (m: ServerMessage) => T | null,
    onStarted?: (send: (m: ClientMessage) => void) => void,
  ): Promise<T | { kind: "error"; error: string }> {
    return new Promise((resolve, reject) => {
      if (!bearerToken) {
        reject(new Error("no session"));
        return;
      }
      const token = bearerToken;
      ensureBaseUrl()
        .then((base) => {
          const socket = new WS(`${base.replace(/^http/, "ws")}/v1/ws`);
          let settled = false;
          const finish = (outcome: T | { kind: "error"; error: string }) => {
            if (settled) return;
            settled = true;
            socket.close();
            resolve(outcome);
          };
          socket.onopen = () => socket.send(JSON.stringify({ type: "auth", token } satisfies ClientMessage));
          socket.onmessage = (ev) => {
            let msg: ServerMessage;
            try {
              msg = JSON.parse(String(ev.data)) as ServerMessage;
            } catch {
              return;
            }
            if (msg.type === "authed") {
              socket.send(JSON.stringify(start));
              onStarted?.((m) => {
                if (!settled) socket.send(JSON.stringify(m));
              });
              return;
            }
            onMessage(msg);
            const outcome = ends(msg);
            if (outcome) finish(outcome);
          };
          socket.onerror = () => finish({ kind: "error", error: "connection to the agent failed" });
          socket.onclose = () => finish({ kind: "error", error: "connection to the agent closed" });
        })
        .catch(reject);
    });
  }

  /**
   * A task over its own connection, started by `start` (`task` or `choose_offer`). `not_supported`
   * answers a message to the agent (a note) and the task goes on, unless `unsupportedEnds`: then the
   * agent does not know the start message itself.
   */
  function taskSession(
    start: ClientMessage,
    projectId: string,
    unsupportedEnds: boolean,
    onMessage: (m: ServerMessage) => void,
    onControl?: (control: TaskControl) => void,
  ): Promise<TaskOutcome> {
    let started = false;
    return agentSession(
      start,
      onMessage,
      (msg) => {
        if (msg.type !== "error") started = true;
        if (msg.type === "done") return { kind: "done", code: msg.code, status: msg.status, commit: msg.commit ?? undefined };
        if (msg.type === "error" && msg.code === "not_supported" && (started || !unsupportedEnds)) return null;
        if (msg.type === "error") return { kind: "error", error: msg.error, code: msg.code ?? undefined };
        if (msg.type === "cancelled") return { kind: "cancelled" };
        return null;
      },
      onControl &&
        ((send) =>
          onControl({
            stop: () => send({ type: "stop" }),
            resume: () => send({ type: "resume" }),
            cancel: () => send({ type: "cancel" }),
            note: (text, attachments = []) => send({ type: "note", project: projectId, text, attachments }),
          })),
    );
  }

  const transport: AgentTransport = {
    async getHealth(): Promise<AgentHealth> {
      try {
        if (!baseUrl && deps.discover !== false) {
          const found = await discoverAgentBaseUrl(fetchFn);
          if (found) baseUrl = found;
        }
        if (!baseUrl) return { ok: false };
        const hello = await fetchAgentHello(fetchFn, baseUrl);
        if (!hello) return { ok: false };
        return {
          ok: true,
          version: hello.version,
          ...(hello.extraOriginsActive ? { extraOriginsActive: true } : {}),
        };
      } catch {
        return { ok: false };
      }
    },

    async authenticateSession(clientKey: CryptoKey) {
      const keyId = deps.getKeyId ? await deps.getKeyId(clientKey) : "browser-key";
      const challengeRes = await apiFetch("/v1/auth/challenge", {
        method: "POST",
        body: JSON.stringify({ keyId }),
      });
      if (!challengeRes.ok) throw new Error("challenge failed");
      const { nonce } = (await challengeRes.json()) as { nonce: string };
      const sign = deps.signNonce ?? (async () => "mock-signature");
      const signature = await sign(clientKey, nonce);
      const sessionRes = await apiFetch("/v1/auth/session", {
        method: "POST",
        body: JSON.stringify({ keyId, nonce, signature }),
      });
      if (!sessionRes.ok) throw new Error("session failed");
      const { token } = (await sessionRes.json()) as { token: string };
      bearerToken = token;
      return { token };
    },

    async startPairing(params) {
      const res = await apiFetch("/v1/pair/start", {
        method: "POST",
        body: JSON.stringify({ publicKeyJwk: params.publicKeyJwk, name: params.name }),
      });
      if (!res.ok) throw new Error("pairing failed");
      return (await res.json()) as PairStartResult;
    },

    async getPairingStatus(pairId) {
      const res = await apiFetch(`/v1/pair/status?id=${encodeURIComponent(pairId)}`);
      if (!res.ok) throw new Error("pairing status failed");
      return (await res.json()) as PairStatusResult;
    },

    async listProjects() {
      const body = await fetchProjects();
      return body.projects.map((projectId) => ({ projectId }));
    },

    async getProject(projectId: string) {
      const all = await transport.listProjects();
      const hit = all.find((p) => p.projectId === projectId);
      if (!hit) throw new Error("project not found");
      return { projectId } satisfies ProjectMetadata;
    },

    async findProjectsByUpstream(upstream: string) {
      // Projects whose code comes from this repository, or from a fork / pull request of it.
      const wanted = upstream.toLowerCase();
      const body = await fetchProjects();
      return (body.details ?? [])
        .filter((p) => p.source?.toLowerCase() === wanted || p.original?.toLowerCase() === wanted)
        .map((p) => ({ projectId: p.name }));
    },

    async cloneProject(params: { upstream: string; ref?: string }) {
      const res = await transport.importProject({ repo: params.upstream, ref: params.ref });
      return { projectId: res.project };
    },

    async getGraph(
      params: { projectId: string; view?: "parts" | "folders" } | string,
      view?: "parts" | "folders",
    ): Promise<GraphResponse> {
      const projectId = typeof params === "string" ? params : params.projectId;
      const v = (typeof params === "object" ? params.view : undefined) ?? view;
      const q = new URLSearchParams();
      q.set("project", projectId);
      if (v === "folders") {
        q.set("view", "folders");
      }
      const res = await apiFetch(`/v1/graph?${q.toString()}`);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        const error = new Error(err.error ?? `get graph failed (${res.status})`);
        (error as { status?: number }).status = res.status;
        throw error;
      }
      return (await res.json()) as GraphResponse;
    },

    async getCanvas({ projectId, from }): Promise<CanvasResponse> {
      const q = new URLSearchParams({ project: projectId, from: String(from) });
      const res = await apiFetch(`/v1/canvas?${q.toString()}`);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        const error = new Error(err.error ?? `get canvas failed (${res.status})`);
        (error as { status?: number }).status = res.status;
        throw error;
      }
      return (await res.json()) as CanvasResponse;
    },

    async describeGraph(
      params: { projectId: string; lang?: string } | string,
      lang?: string,
    ): Promise<GraphResponse> {
      const projectId = typeof params === "string" ? params : params.projectId;
      const l = (typeof params === "object" ? params.lang : undefined) ?? lang;
      const body: DescribeRequest = {
        project: projectId,
        ...(l ? { lang: l } : {}),
      };
      const res = await apiFetch("/v1/graph/describe", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        throw new AgentApiError(err.error ?? `describe graph failed (${res.status})`, res.status, {
          code: err.code,
        });
      }
      return (await res.json()) as GraphResponse;
    },

    async listFiles(projectId: string): Promise<ProjectFilesResponse> {
      const res = await apiFetch(`/v1/files?project=${encodeURIComponent(projectId)}`);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        const error = new Error(err.error ?? `list files failed (${res.status})`);
        (error as { status?: number }).status = res.status;
        throw error;
      }
      return (await res.json()) as ProjectFilesResponse;
    },

    async readFile(params): Promise<FileResponse> {
      assertSafePath(params.path);
      const res = await apiFetch(
        `/v1/file?project=${encodeURIComponent(params.projectId)}&path=${encodeURIComponent(params.path)}`,
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        const error = new Error(err.error ?? `read file failed (${res.status})`);
        (error as { status?: number }).status = res.status;
        throw error;
      }
      return (await res.json()) as FileResponse;
    },

    async readDiff(params): Promise<FileDiffResponse> {
      assertSafePath(params.path);
      const res = await apiFetch(
        `/v1/diff?project=${encodeURIComponent(params.projectId)}&path=${encodeURIComponent(params.path)}`,
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        const error = new Error(err.error ?? `read diff failed (${res.status})`);
        (error as { status?: number }).status = res.status;
        throw error;
      }
      return (await res.json()) as FileDiffResponse;
    },

    async getModels() {
      const res = await apiFetch("/v1/models");
      if (!res.ok) throw new Error("models failed");
      const body = (await res.json()) as { models: ModelInfo[] };
      return body.models;
    },

    async getAiStatus(): Promise<AiResponse> {
      const res = await apiFetch("/v1/ai");
      if (!res.ok) throw new Error("get AI status failed");
      return (await res.json()) as AiResponse;
    },

    async connectAi(provider: string, mode?: CliHomeMode): Promise<AiConnectResponse> {
      const body: AiConnectRequest = { provider, ...(mode ? { mode } : {}) };
      const res = await apiFetch("/v1/ai/connect", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        const msg = err.error ?? `connect AI failed (${res.status})`;
        throw new AgentApiError(msg, res.status, {
          code: err.code,
        });
      }
      return (await res.json()) as AiConnectResponse;
    },

    async disconnectAi(provider: string): Promise<AiDisconnectResponse> {
      const payload: AiDisconnectRequest = { provider };
      const res = await apiFetch("/v1/ai/disconnect", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        const msg = err.error ?? `disconnect AI failed (${res.status})`;
        throw new AgentApiError(msg, res.status, {
          code: err.code,
        });
      }
      return (await res.json()) as AiDisconnectResponse;
    },

    async connectGithub(): Promise<GithubConnectResponse> {
      const res = await apiFetch("/v1/github/connect", {
        method: "POST",
        body: "{}",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `connect GitHub failed (${res.status})`);
      }
      return (await res.json()) as GithubConnectResponse;
    },

    async getGithubStatus(): Promise<GithubStatusResponse> {
      const res = await apiFetch("/v1/github/status", {
        method: "GET",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `get GitHub status failed (${res.status})`);
      }
      return (await res.json()) as GithubStatusResponse;
    },

    async importProject(req: ImportProjectRequest): Promise<ImportProjectResult> {
      const body: ImportProjectRequest = { repo: req.repo };
      if (req.ref) body.ref = req.ref;
      if (req.upstream) body.upstream = req.upstream;
      const res = await apiFetch("/v1/projects/import", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
          resetMinutes?: number;
          reset_minutes?: number;
        };
        const resetMinutes = err.resetMinutes ?? err.reset_minutes;
        const msg = err.error ?? `import failed (${res.status})`;
        throw new AgentApiError(msg, res.status, {
          code: err.code ?? (res.status === 429 ? "rate_limit" : undefined),
          resetMinutes,
        });
      }
      return (await res.json()) as ImportProjectResult;
    },

    async getJournal(projectId: string): Promise<JournalResponse> {
      const res = await apiFetch(`/v1/journal?project=${encodeURIComponent(projectId)}`);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        throw new AgentApiError(err.error ?? `read journal failed (${res.status})`, res.status, { code: err.code });
      }
      return (await res.json()) as JournalResponse;
    },

    async rollback(params): Promise<RollbackResponse> {
      const body: RollbackRequest = { project: params.projectId, commit: params.commit };
      const res = await apiFetch("/v1/rollback", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        throw new AgentApiError(err.error ?? `rollback failed (${res.status})`, res.status, { code: err.code });
      }
      return (await res.json()) as RollbackResponse;
    },

    rollbackPart(params, onMessage): Promise<RollbackPartOutcome> {
      return agentSession({ type: "rollback_part", project: params.projectId, id: params.id }, onMessage, (msg) => {
        // The part is back once the agent reports the result on the canvas.
        if (msg.type === "canvas" && msg.ev.type === "result") return { kind: "done" } as const;
        if (msg.type === "error") return { kind: "error", error: msg.error, code: msg.code ?? undefined } as const;
        return null;
      });
    },

    runBuild(project: string, onMessage: (m: BuildMessage) => void): Promise<BuildOutcome> {
      return agentSession({ type: "build", project }, onMessage, (msg) => {
        if (msg.type === "build_done")
          return { kind: "done", code: msg.code, artifacts: msg.artifacts ?? undefined, files: msg.files };
        if (msg.type === "error") return { kind: "error", error: msg.error, code: msg.code ?? undefined };
        if (msg.type === "cancelled") return { kind: "cancelled" };
        return null;
      });
    },

    runProgram(project, onMessage, onStop): Promise<ProgramOutcome> {
      return agentSession(
        { type: "run", project },
        onMessage,
        (msg) => {
          if (msg.type === "program_done") return { kind: "done", code: msg.code, cut: msg.cut };
          if (msg.type === "error") return { kind: "error", error: msg.error, code: msg.code ?? undefined };
          if (msg.type === "cancelled") return { kind: "cancelled" };
          return null;
        },
        (send) => onStop?.(() => send({ type: "cancel" })),
      );
    },

    runTask(params, onMessage, onControl): Promise<TaskOutcome> {
      return taskSession(
        {
          type: "task",
          project: params.projectId,
          prompt: params.prompt,
          provider: params.provider ?? null,
          model: params.model ?? null,
          continue: params.continue ?? false,
          lang: params.lang ?? null,
        },
        params.projectId,
        false,
        onMessage,
        onControl,
      );
    },

    runOffer(params, onMessage, onControl): Promise<TaskOutcome> {
      return taskSession(
        {
          type: "choose_offer",
          project: params.projectId,
          index: params.index,
          title: params.title ?? null,
          provider: params.provider ?? null,
          model: params.model ?? null,
          continue: params.continue ?? false,
          lang: params.lang ?? null,
        },
        params.projectId,
        true,
        onMessage,
        onControl,
      );
    },

    async saveProject(params) {
      const res = await apiFetch("/v1/save", {
        method: "POST",
        body: JSON.stringify({ project: params.projectId, copy: params.copy }),
      });
      if (!res.ok) throw new Error("save failed");
      return (await res.json()) as SaveProjectResult;
    },
  };

  if (deps.baseUrl) {
    baseUrl = deps.baseUrl.replace(/\/$/, "");
  }

  return transport;
}
