export type NodeStatus = "unknown" | "exploring" | "changing" | "problem" | "done" | string;

export interface NodeCardData extends Record<string, unknown> {
  id: string;
  label: string;
  status: NodeStatus;
  summary?: string;
  isFocused: boolean;
  onFocusNode?: (nodeId: string) => void;
  onAskAbout?: (label: string) => void;
  onExplainProblem?: (nodeId: string) => Promise<string | void>;
}

export interface CanvasPanelProps {
  className?: string;
  onAskAbout?: (label: string) => void;
}
