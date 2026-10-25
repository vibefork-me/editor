import {
  discoverAgentBaseUrl,
  fetchAgentHello,
  probeAgentBaseUrl,
  reconnectDelayMs,
  resolveAgentBaseUrlFromLocation,
} from "./agent-base-url.ts";
import type {
  AgentHealth,
  AgentTransport,
  BuildMessage,
  BuildOutcome,
  GraphSnapshot,
  ImportProjectRequest,
  ImportProjectResult,
  ModelInfo,
  PairStartResult,
  PairStatusResult,
  PlanApproveParams,
  ProjectMetadata,
  SaveProjectResult,
  Subscription,
  TaskAnswerParams,
  TaskEvent,
  TaskStartParams,
} from "./types.ts";
import { notifyWsConnection } from "./ws-connection-bridge.ts";
import type { ProjectsResponse } from "./protocol.generated.ts";

const MAX_TEXT_BYTES = 2 * 1024 * 1024;
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

type WsPending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  kind: string;
};

type ProjectSub = {
  projectId: string;
  afterCursor?: string;
  onSnapshot: (snapshot: GraphSnapshot) => void;
  onGap: () => void;
  bufferRevision: number;
};

type TaskSub = {
  taskId: string;
  afterEventId?: number;
  onEvent: (event: TaskEvent) => void;
  onGap: () => void;
};

function randomRequestId(): string {
  return crypto.randomUUID();
}

function assertSafePath(path: string): void {
  if (path.includes("..") || path.startsWith("/") || /[\0\r\n]/.test(path)) {
    throw new Error("invalid path");
  }
  if (SECRET_PATH_DENY.test(path)) {
    throw new Error("path denied");
  }
}

function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
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

  const pending = new Map<string, WsPending>();
  const projectSubs = new Map<symbol, ProjectSub>();
  const taskSubs = new Map<symbol, TaskSub>();

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

  function parseGraphSnapshot(data: unknown): GraphSnapshot {
    const d = data as GraphSnapshot;
    return {
      revision: d.revision,
      nodes: d.nodes ?? [],
      edges: d.edges ?? [],
      focus: d.focus ?? null,
      phase: d.phase ?? "exploring",
    };
  }

  function handleWsMessage(raw: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    const type = String(msg.type ?? "");

    const requestId = typeof msg.requestId === "string" ? msg.requestId : null;
    if (requestId && pending.has(requestId)) {
      const entry = pending.get(requestId)!;
      if (entry.kind === type || type.endsWith("_result") || type === "graph_explanation") {
        pending.delete(requestId);
        if (type === "graph_error" || (msg.code && type === "error")) {
          entry.reject(new Error(String(msg.code ?? msg.message ?? "request failed")));
        } else {
          entry.resolve(msg);
        }
      }
    }

    if (type === "project_event" && msg.eventType === "graph_update") {
      const project = String(msg.project ?? "");
      const cursor = typeof msg.cursor === "string" ? msg.cursor : undefined;
      const snapshot = parseGraphSnapshot(msg.data);
      for (const sub of projectSubs.values()) {
        if (sub.projectId !== project) continue;
        if (snapshot.revision <= sub.bufferRevision) continue;
        sub.bufferRevision = snapshot.revision;
        if (cursor) sub.afterCursor = cursor;
        sub.onSnapshot(snapshot);
      }
      return;
    }

    if (type === "replay_gap" || type === "project_replay_gap") {
      const project = String(msg.project ?? "");
      for (const sub of projectSubs.values()) {
        if (sub.projectId !== project) continue;
        sub.afterCursor = undefined;
        sub.bufferRevision = 0;
        sub.onGap();
        sendProjectSubscribe(sub);
      }
      return;
    }

    if (type === "task_event") {
      const taskId = String(msg.taskId ?? "");
      const event: TaskEvent = {
        taskId,
        eventId: Number(msg.eventId),
        at: String(msg.at ?? ""),
        type: String(msg.eventType ?? msg.type ?? "unknown"),
        data: msg.data,
      };
      if (event.type === "graph_update") {
        const snapshot = parseGraphSnapshot(msg.data);
        for (const sub of projectSubs.values()) {
          if (snapshot.revision > sub.bufferRevision) {
            sub.bufferRevision = snapshot.revision;
            sub.onSnapshot(snapshot);
          }
        }
      }
      for (const sub of taskSubs.values()) {
        if (sub.taskId !== taskId) continue;
        sub.afterEventId = event.eventId;
        sub.onEvent(event);
      }
      return;
    }

    if (type === "task_replay_expired") {
      const taskId = String(msg.taskId ?? "");
      for (const sub of taskSubs.values()) {
        if (sub.taskId !== taskId) continue;
        sub.afterEventId = undefined;
        sub.onGap();
        sendTaskSubscribe(sub);
      }
    }
  }

  function sendWs(payload: Record<string, unknown>): boolean {
    if (!ws || ws.readyState !== WS.OPEN) {
      return false;
    }
    ws.send(JSON.stringify(payload));
    return true;
  }

  function sendProjectSubscribe(sub: ProjectSub): void {
    const body: Record<string, unknown> = {
      type: "project_research_subscribe",
      requestId: randomRequestId(),
      project: sub.projectId,
    };
    if (sub.afterCursor) body.afterCursor = sub.afterCursor;
    if (!sendWs(body)) scheduleReconnect();
  }

  function sendTaskSubscribe(sub: TaskSub): void {
    const body: Record<string, unknown> = {
      type: "task_subscribe",
      requestId: randomRequestId(),
      taskId: sub.taskId,
    };
    if (sub.afterEventId !== undefined) body.afterEventId = sub.afterEventId;
    if (!sendWs(body)) scheduleReconnect();
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
            for (const sub of projectSubs.values()) sendProjectSubscribe(sub);
            for (const sub of taskSubs.values()) sendTaskSubscribe(sub);
            resolve();
          };
          ws.onmessage = (ev) => handleWsMessage(String(ev.data));
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

  async function ensureWs(): Promise<void> {
    if (ws && ws.readyState === WS.OPEN) return;
    await connectWs();
  }

  function waitWs<T>(requestId: string, kind: string, timeoutMs = 10_000): Promise<T> {
    return new Promise((resolve, reject) => {
      pending.set(requestId, {
        kind,
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      schedule(() => {
        if (pending.has(requestId)) {
          pending.delete(requestId);
          reject(new Error("WebSocket request timed out"));
        }
      }, timeoutMs);
    });
  }

  async function fetchProjects(): Promise<ProjectsResponse> {
    const res = await apiFetch("/v1/projects");
    if (!res.ok) throw new Error("list projects failed");
    return (await res.json()) as ProjectsResponse;
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

    subscribeProjectResearch(params) {
      const id = Symbol("project-sub");
      const sub: ProjectSub = {
        projectId: params.projectId,
        afterCursor: params.afterCursor,
        onSnapshot: params.onSnapshot,
        onGap: params.onGap,
        bufferRevision: 0,
      };
      projectSubs.set(id, sub);
      void ensureWs()
        .then(() => sendProjectSubscribe(sub))
        .catch(() => scheduleReconnect());
      return {
        unsubscribe() {
          projectSubs.delete(id);
        },
      } satisfies Subscription;
    },

    async startTask(params: TaskStartParams) {
      await ensureWs();
      const requestId = randomRequestId();
      if (
        !sendWs({
          type: "task_start",
          requestId,
          project: params.projectId,
          prompt: params.prompt,
          provider: params.provider,
          model: params.model,
          continue: params.continue,
          mode: params.mode,
        })
      ) {
        throw new Error("WebSocket is not connected");
      }
      const accepted = await waitWs<{ taskId: string }>(requestId, "task_accepted");
      return { taskId: accepted.taskId };
    },

    subscribeTask(params) {
      const id = Symbol("task-sub");
      const sub: TaskSub = {
        taskId: params.taskId,
        afterEventId: params.afterEventId,
        onEvent: params.onEvent,
        onGap: params.onGap,
      };
      taskSubs.set(id, sub);
      void ensureWs()
        .then(() => sendTaskSubscribe(sub))
        .catch(() => scheduleReconnect());
      return {
        unsubscribe() {
          taskSubs.delete(id);
        },
      } satisfies Subscription;
    },

    async sendAnswer(params: TaskAnswerParams) {
      await ensureWs();
      const requestId = randomRequestId();
      if (
        !sendWs({
          type: "answer",
          requestId,
          taskId: params.taskId,
          questionId: params.questionId,
          answer: params.answer,
        })
      ) {
        throw new Error("WebSocket is not connected");
      }
    },

    async approvePlan(params: PlanApproveParams) {
      await ensureWs();
      const requestId = randomRequestId();
      if (
        !sendWs({
          type: "plan_approve",
          requestId,
          taskId: params.taskId,
          planId: params.planId,
        })
      ) {
        throw new Error("WebSocket is not connected");
      }
    },

    async focusNode(params) {
      await ensureWs();
      const requestId = randomRequestId();
      if (
        !sendWs({
          type: "graph_focus",
          requestId,
          project: params.projectId,
          nodeId: params.nodeId,
        })
      ) {
        throw new Error("WebSocket is not connected");
      }
      const result = await waitWs<{ accepted: boolean }>(requestId, "graph_focus_result");
      return { accepted: Boolean(result.accepted) };
    },

    async explainNode(params) {
      await ensureWs();
      const requestId = randomRequestId();
      if (
        !sendWs({
          type: "graph_explain",
          requestId,
          project: params.projectId,
          nodeId: params.nodeId,
        })
      ) {
        throw new Error("WebSocket is not connected");
      }
      const result = await waitWs<{ summary: string }>(requestId, "graph_explanation");
      return { explanation: String(result.summary ?? "") };
    },

    async readFile(params) {
      assertSafePath(params.path);
      const res = await apiFetch(
        `/v1/projects/${encodeURIComponent(params.projectId)}/file?path=${encodeURIComponent(params.path)}`,
      );
      if (!res.ok) throw new Error("read file failed");
      const body = (await res.json()) as { content: string };
      if (utf8ByteLength(body.content) > MAX_TEXT_BYTES) {
        throw new Error("file too large");
      }
      return { content: body.content };
    },

    async readDiff(params) {
      assertSafePath(params.path);
      const res = await apiFetch(
        `/v1/projects/${encodeURIComponent(params.projectId)}/git/diff?path=${encodeURIComponent(params.path)}`,
      );
      if (!res.ok) throw new Error("read diff failed");
      const body = (await res.json()) as { original: string; modified: string };
      return body;
    },

    async getModels() {
      const res = await apiFetch("/v1/models");
      if (!res.ok) throw new Error("models failed");
      const body = (await res.json()) as { models: ModelInfo[] };
      return body.models;
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
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `import failed (${res.status})`);
      }
      return (await res.json()) as ImportProjectResult;
    },

    runBuild(project: string, onMessage: (m: BuildMessage) => void): Promise<BuildOutcome> {
      // A connection of its own: the build speaks the agent's message set (auth → build → events).
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
            const finish = (outcome: BuildOutcome) => {
              if (settled) return;
              settled = true;
              socket.close();
              resolve(outcome);
            };
            socket.onopen = () => socket.send(JSON.stringify({ type: "auth", token }));
            socket.onmessage = (ev) => {
              let msg: BuildMessage;
              try {
                msg = JSON.parse(String(ev.data)) as BuildMessage;
              } catch {
                return;
              }
              if (msg.type === "authed") {
                socket.send(JSON.stringify({ type: "build", project }));
                return;
              }
              onMessage(msg);
              if (msg.type === "build_done") {
                finish({
                  kind: "done",
                  code: msg.code,
                  artifacts: msg.artifacts ?? undefined,
                  files: msg.files,
                });
              }
              else if (msg.type === "error") finish({ kind: "error", error: msg.error });
              else if (msg.type === "cancelled") finish({ kind: "cancelled" });
            };
            socket.onerror = () => finish({ kind: "error", error: "connection to the agent failed" });
            socket.onclose = () => finish({ kind: "error", error: "connection to the agent closed" });
          })
          .catch(reject);
      });
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
