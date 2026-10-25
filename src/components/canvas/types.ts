export type NodeStatus = "unknown" | "exploring" | "changing" | "problem" | "done" | "changed" | "unchanged";

export interface NodeCardData extends Record<string, unknown> {
  id: string;
  label: string;
  status: NodeStatus;
  summary?: string;
  isFocused: boolean;
  isFocusPulseDisabled: boolean;
  tabIndex: 0 | -1;
  onFocusNode?: (nodeId: string) => void;
  onAskAbout?: (label: string) => void;
  onExplainProblem?: (nodeId: string) => Promise<string | void>;
}

export interface CanvasPanelProps {
  className?: string;
  onAskAbout?: (label: string) => void;
  onSave?: () => void;
}
