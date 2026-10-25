export interface GraphNode {
  id: string;
  label: string;
  status: "exploring" | "problem" | "changing" | "done" | string;
  summary?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

export interface GraphSnapshot {
  revision: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  focus: string | null;
  phase: string;
}

export interface AgentCapabilityLimit {
  id: string;
  version: string;
  limits?: Record<string, number | string | boolean>;
  enabled?: boolean;
  reasonCode?: string;
}

export interface AgentCapabilities {
  apiVersion: string;
  agentVersion: string;
  capabilities: AgentCapabilityLimit[];
  limits?: Record<string, number>;
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

export interface TaskStartParams {
  projectId: string;
  prompt: string;
  provider?: string;
  model?: string;
  continue?: boolean;
  mode?: string;
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

export interface TaskAnswerParams {
  taskId: string;
  questionId: string;
  answer: string;
}

export interface PlanApproveParams {
  taskId: string;
  planId: string;
}

export interface TaskEvent {
  taskId: string;
  eventId: number;
  at: string;
  type: string;
  data: unknown;
}

export interface Subscription {
  unsubscribe(): void;
}

export interface AgentHello {
  agent: string;
  version: string;
  platform: string;
  extraOrigins?: string[];
}

export interface AgentHealth {
  ok: boolean;
  version?: string;
  extraOrigins?: string[];
}

/** `POST /v1/projects/import` of the agent: where the code comes from. */
export type ImportProjectRequest = {
  /** `owner/name` of the repository with the code (the original or a fork). */
  repo: string;
  /** Branch, tag, commit or `pull/<N>/head`. */
  ref?: string;
  /** The original when the code is a fork or a pull request. */
  upstream?: string;
};

/** What code from outside the original changes, by file name (agent `ForeignChanges`). */
export type ForeignChanges = {
  source: string;
  files: number;
  dependencies: string[];
  buildScripts: string[];
  binaries: string[];
  complete: boolean;
  compareUrl: string;
};

export type ImportProjectResult = {
  project: string;
  upstream: string;
  commit: string;
  foreign?: ForeignChanges;
};

/** One message of the agent while it builds (agent `ServerMessage`, `type` in snake_case). */
export type BuildMessage = { type: string } & Record<string, unknown>;

/** How a build ended. */
export type BuildOutcome =
  | { kind: "done"; code: number; artifacts?: string; files: string[] }
  | { kind: "error"; error: string }
  | { kind: "cancelled" };

export interface AgentTransport {
  getHealth(): Promise<AgentHealth>;
  getCapabilities(): Promise<AgentCapabilities>;
  authenticateSession(clientKey: CryptoKey): Promise<{ token: string }>;
  startPairing(params: { publicKeyJwk: JsonWebKey; name?: string }): Promise<PairStartResult>;
  getPairingStatus(pairId: string): Promise<PairStatusResult>;

  getProject(projectId: string): Promise<ProjectMetadata>;
  listProjects(): Promise<ProjectSummary[]>;
  findProjectsByUpstream(upstream: string): Promise<{ projectId: string }[]>;
  cloneProject(params: { upstream: string; ref?: string }): Promise<{ projectId: string }>;

  subscribeProjectResearch(params: {
    projectId: string;
    afterCursor?: string;
    onSnapshot: (snapshot: GraphSnapshot) => void;
    onGap: () => void;
  }): Subscription;

  startTask(params: TaskStartParams): Promise<{ taskId: string }>;
  saveProject(params: { projectId: string; copy?: string }): Promise<SaveProjectResult>;
  subscribeTask(params: {
    taskId: string;
    afterEventId?: number;
    onEvent: (event: TaskEvent) => void;
    onGap: () => void;
  }): Subscription;
  sendAnswer(params: TaskAnswerParams): Promise<void>;
  approvePlan(params: PlanApproveParams): Promise<void>;

  focusNode(params: { projectId: string; nodeId: string }): Promise<{ accepted: boolean }>;
  explainNode(params: { projectId: string; nodeId: string }): Promise<{ explanation: string }>;

  readFile(params: { projectId: string; path: string }): Promise<{ content: string }>;
  readDiff(params: {
    projectId: string;
    path: string;
  }): Promise<{ original: string; modified: string }>;

  getModels(): Promise<ModelInfo[]>;

  /** Takes a project from GitHub, optionally at a ref of a fork or a pull request. */
  importProject(req: ImportProjectRequest): Promise<ImportProjectResult>;
  /** Builds a project (the agent asks the user in a native dialog); streams its messages. */
  runBuild(project: string, onMessage: (m: BuildMessage) => void): Promise<BuildOutcome>;
}
