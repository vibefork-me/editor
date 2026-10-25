import type {
  AiConnectResponse,
  AiResponse,
  GithubConnectResponse,
  GithubStatusResponse,
} from "./protocol.generated.ts";

export type {
  AiConnectRequest,
  AiConnectResponse,
  AiConnected,
  AiKind,
  AiProvider,
  AiResponse,
  GithubConnectResponse,
  GithubStatusResponse,
} from "./protocol.generated.ts";

export class AgentApiError extends Error {
  readonly status: number;
  readonly code?: string | null;
  readonly resetMinutes?: number | null;

  constructor(
    message: string,
    status: number,
    options?: { code?: string | null; resetMinutes?: number | null },
  ) {
    super(message);
    this.name = "AgentApiError";
    this.status = status;
    this.code = options?.code;
    this.resetMinutes = options?.resetMinutes;
  }
}

export interface GraphNode {
  id: string;
  label: string;
  files?: number;
  changed?: number;
  status: "changed" | "unchanged" | "exploring" | "problem" | "changing" | "done" | string;
  summary?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

export interface GraphSnapshot {
  revision: number | string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  focus: string | null;
  phase: string;
}

export interface ProjectSummary {
  projectId: string;
  upstream?: string;
}

export interface ProjectMetadata {
  projectId: string;
  upstream?: string;
}

export interface ModelInfo {
  provider: string;
  model: string;
  label: string;
  cost: string;
  tier: number;
}

export type SaveStep =
  | "saved"
  | "unchanged"
  | "connect_github"
  | "create_copy"
  | "create_repo"
  | "allow_app"
  | "narrow_access"
  | "conflict";

export interface SaveProjectResult {
  step: SaveStep;
  url: string | null;
  copy: string | null;
  commit: string | null;
  next_url?: string | null;
  name?: string | null;
  files?: string[];
}

export interface PairStartResult {
  pairId: string;
  code: string;
}

export interface PairStatusResult {
  status: "pending" | "approved" | "denied";
  keyId?: string;
}

export interface Subscription {
  unsubscribe(): void;
}

export interface AgentHealth {
  ok: boolean;
  version?: string;
  /** A development build of the agent allows extra web origins. */
  extraOriginsActive?: boolean;
}

import type { TaskOutcome } from "./task-feed.ts";

// Messages and bodies the agent defines: generated from its schema (src/client/protocol.generated.ts).
import type {
  DescribeRequest,
  FileDiffResponse,
  FileResponse,
  ForeignChanges as AgentForeignChanges,
  GraphResponse,
  GraphSource,
  Hello,
  ImportRequest,
  ImportResponse,
  ServerMessage,
} from "./protocol.generated.ts";

export type {
  DescribeRequest,
  FileDiffResponse,
  FileResponse,
  GraphResponse,
  GraphSource,
};

/** `GET /v1/hello` of the agent. */
export type AgentHello = Hello;
/** `POST /v1/projects/import`: where the code comes from. */
export type ImportProjectRequest = ImportRequest;
/** What code from outside the original changes, by file name. */
export type ForeignChanges = AgentForeignChanges;
export type ImportProjectResult = ImportResponse;
/** One message of the agent while it builds. */
export type BuildMessage = ServerMessage;

/** How a build ended. */
export type BuildOutcome =
  | { kind: "done"; code: number; artifacts?: string; files: string[] }
  | { kind: "error"; error: string; code?: string }
  | { kind: "cancelled" };

export interface AgentTransport {
  getHealth(): Promise<AgentHealth>;
  authenticateSession(clientKey: CryptoKey): Promise<{ token: string }>;
  startPairing(params: { publicKeyJwk: JsonWebKey; name?: string }): Promise<PairStartResult>;
  getPairingStatus(pairId: string): Promise<PairStatusResult>;

  getProject(projectId: string): Promise<ProjectMetadata>;
  listProjects(): Promise<ProjectSummary[]>;
  findProjectsByUpstream(upstream: string): Promise<{ projectId: string }[]>;
  cloneProject(params: { upstream: string; ref?: string }): Promise<{ projectId: string }>;

  getGraph(
    params: { projectId: string; view?: "parts" | "folders" } | string,
    view?: "parts" | "folders",
  ): Promise<GraphResponse>;
  describeGraph(
    params: { projectId: string; lang?: string } | string,
    lang?: string,
  ): Promise<GraphResponse>;

  saveProject(params: { projectId: string; copy?: string }): Promise<SaveProjectResult>;

  readFile(params: { projectId: string; path: string }): Promise<FileResponse>;
  readDiff(params: {
    projectId: string;
    path: string;
  }): Promise<FileDiffResponse>;

  getModels(): Promise<ModelInfo[]>;
  getAiStatus(): Promise<AiResponse>;
  connectAi(provider: string): Promise<AiConnectResponse>;

  /** Starts GitHub device authorization flow. */
  connectGithub(): Promise<GithubConnectResponse>;
  /** Checks current GitHub authorization status. */
  getGithubStatus(): Promise<GithubStatusResponse>;

  /** Takes a project from GitHub, optionally at a ref of a fork or a pull request. */
  importProject(req: ImportProjectRequest): Promise<ImportProjectResult>;
  /** Runs a task in a project over the agent's own messages; streams them; resolves when it ends. */
  runTask(
    params: { projectId: string; prompt: string; provider?: string; model?: string; continue?: boolean },
    onMessage: (m: ServerMessage) => void,
  ): Promise<TaskOutcome>;
  /** Builds a project (the agent asks the user in a native dialog); streams its messages. */
  runBuild(project: string, onMessage: (m: BuildMessage) => void): Promise<BuildOutcome>;
}
