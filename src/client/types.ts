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

export interface AgentTransport {
  getHealth(): Promise<{ ok: boolean }>;
  getCapabilities(): Promise<AgentCapabilities>;
  authenticateSession(clientKey: CryptoKey): Promise<{ token: string }>;

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
}
