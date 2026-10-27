import type {
  AiConnectResponse,
  AiDisconnectResponse,
  AiResponse,
  CliHomeMode,
  GithubConnectResponse,
  GithubStatusResponse,
} from "./protocol.generated.ts";

export type {
  AiConnectRequest,
  AiConnectResponse,
  AiConnected,
  AiDisconnectRequest,
  AiDisconnectResponse,
  AiKind,
  AiProvider,
  AiResponse,
  CliHomeMode,
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
  /** The part this one is a smaller piece of (model's map only); absent — a top part. */
  parent?: string;
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
  CanvasResponse,
  DescribeRequest,
  FileDiffResponse,
  FileResponse,
  ForeignChanges as AgentForeignChanges,
  GraphResponse,
  GraphSource,
  Hello,
  ImportRequest,
  ImportResponse,
  JournalEntry,
  JournalResponse,
  NoteAttachment,
  ProjectFilesResponse,
  RollbackResponse,
  ServerMessage,
} from "./protocol.generated.ts";

export type {
  JournalEntry,
  JournalResponse,
  RollbackResponse,
  NoteAttachment,
  CanvasResponse,
  DescribeRequest,
  FileDiffResponse,
  FileResponse,
  GraphResponse,
  GraphSource,
  ProjectFilesResponse,
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

/** How a run of the project's program ended. */
export type ProgramOutcome =
  | { kind: "done"; code: number; cut: boolean }
  | { kind: "error"; error: string; code?: string }
  | { kind: "cancelled" };

/** How rolling one part back ended: `done` once the agent reports the result; an error has the agent's code
 * (`not_found`, `nothing_to_roll_back`, `rollback_not_confirmed`, `not_supported`, …). */
export type RollbackPartOutcome = { kind: "done" } | { kind: "error"; error: string; code?: string };

/** What the person can do with a running task. */
export interface TaskControl {
  /** Pauses it at once. */
  stop(): void;
  /** Continues a paused task. */
  resume(): void;
  /** Cancels it; a paused task's changes are undone too. */
  cancel(): void;
  /** Sends a message to the agent; it is taken into account at the next point that allows it
   * (`note.taken` on the canvas). An agent without notes answers `error` with code `not_supported`. */
  note(text: string, attachments?: NoteAttachment[]): void;
}

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
  /** The session stream of a project from event `from` (at most one page; follow `next`). */
  getCanvas(params: { projectId: string; from: number }): Promise<CanvasResponse>;

  saveProject(params: { projectId: string; copy?: string }): Promise<SaveProjectResult>;

  /** Files of the project for the file tree (`.gitignore` respected); an agent without `/v1/files` fails with status 404. */
  listFiles(projectId: string): Promise<ProjectFilesResponse>;
  readFile(params: { projectId: string; path: string }): Promise<FileResponse>;
  readDiff(params: {
    projectId: string;
    path: string;
  }): Promise<FileDiffResponse>;

  getModels(): Promise<ModelInfo[]>;
  getAiStatus(): Promise<AiResponse>;
  connectAi(provider: string, mode?: CliHomeMode): Promise<AiConnectResponse>;
  disconnectAi(provider: string): Promise<AiDisconnectResponse>;

  /** Starts GitHub device authorization flow. */
  connectGithub(): Promise<GithubConnectResponse>;
  /** Checks current GitHub authorization status. */
  getGithubStatus(): Promise<GithubStatusResponse>;

  /** Takes a project from GitHub, optionally at a ref of a fork or a pull request. */
  importProject(req: ImportProjectRequest): Promise<ImportProjectResult>;
  /** Runs a task in a project over the agent's own messages; streams them; resolves when it ends.
   * `onControl` gets the way to pause, resume or cancel it once it has started. */
  runTask(
    params: {
      projectId: string;
      prompt: string;
      provider?: string;
      model?: string;
      continue?: boolean;
      lang?: string;
    },
    onMessage: (m: ServerMessage) => void,
    onControl?: (control: TaskControl) => void,
  ): Promise<TaskOutcome>;
  /** Runs the task an offer of the analysis suggests (`index` in the last `offers` event, `title` as
   * shown), like `runTask`. An agent without it ends with the error code `not_supported`; a stale offer
   * with `no_offers` or `bad_index`. */
  runOffer(
    params: {
      projectId: string;
      index: number;
      title?: string;
      provider?: string;
      model?: string;
      continue?: boolean;
      lang?: string;
    },
    onMessage: (m: ServerMessage) => void,
    onControl?: (control: TaskControl) => void,
  ): Promise<TaskOutcome>;
  /** The project's journal: its tasks and plan steps, oldest first, with their checkpoints. */
  getJournal(projectId: string): Promise<JournalResponse>;
  /** Resets the project to a checkpoint of its journal (the agent asks the user in a native dialog);
   * fails with an `AgentApiError` (e.g. code `rollback_not_confirmed`). */
  rollback(params: { projectId: string; commit: string }): Promise<RollbackResponse>;
  /** Puts one part of the map back as it was before the last task that changed it (the agent asks the
   * user in a native dialog); streams its messages (`canvas` events). Only while no task runs. */
  rollbackPart(params: { projectId: string; id: string }, onMessage: (m: ServerMessage) => void): Promise<RollbackPartOutcome>;
  /** Builds a project (the agent asks the user in a native dialog); streams its messages. */
  runBuild(project: string, onMessage: (m: BuildMessage) => void): Promise<BuildOutcome>;
  /**
   * Runs the project's program (the agent asks the user in a native dialog); streams its output
   * (`program_log`). `onStop` gets a function that stops it. An older agent answers `not_supported`.
   */
  runProgram(project: string, onMessage: (m: ServerMessage) => void, onStop?: (stop: () => void) => void): Promise<ProgramOutcome>;
}
