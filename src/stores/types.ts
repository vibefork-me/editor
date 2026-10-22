export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export type GraphPhase = "exploring" | "edit" | "build" | "test" | "check" | "done";

export type ViewerMode = "file" | "diff";

export interface ChoiceOption {
  id: string;
  label: string;
  recommended?: boolean;
}

export interface ChoiceGroupData {
  questionId: string;
  prompt: string;
  options: ChoiceOption[];
}
