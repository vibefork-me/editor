import { create } from "zustand";
import type { ProgramStream, ServerMessage } from "../client/protocol.generated.ts";
import type { ProgramOutcome } from "../client/types.ts";
import { getAgentTransport } from "./agent-bridge.ts";

/** Most lines of the program's output kept on the page; older ones go. */
export const PROGRAM_LINES_KEPT = 1000;

/** A line of the program's output. */
export interface ProgramLine {
  stream: ProgramStream;
  text: string;
}

export type ProgramStatus = "idle" | "starting" | "running" | "exited" | "failed" | "cancelled";
export type ProgramErrorKind = "noConnection" | "notConfirmed" | "noRecipe" | "notSupported" | "agentError";

export interface ProgramState {
  /** The project whose program the output belongs to. */
  projectId: string | null;
  status: ProgramStatus;
  lines: ProgramLine[];
  /** Exit code once it ended by itself. */
  code: number | null;
  /** The agent cut some output: a line too long, or too much of it. */
  cut: boolean;
  errorKey: ProgramErrorKind | null;
  error: string | null;
  /** Stops the running program; null when none runs. */
  stop: (() => void) | null;
  setActiveProject: (projectId: string | null) => void;
  start: (projectId: string) => Promise<ProgramOutcome | null>;
}

/** Whether the run ended badly: a non-zero exit or an error of the agent. */
export function programFailed(s: Pick<ProgramState, "status" | "code">): boolean {
  return s.status === "failed" || (s.status === "exited" && s.code !== 0);
}

function errorKind(outcome: { error: string; code?: string }): ProgramErrorKind {
  switch (outcome.code) {
    case "run_not_confirmed":
      return "notConfirmed";
    case "no_run_recipe":
      return "noRecipe";
    case "not_supported":
      return "notSupported";
    default:
      return "agentError";
  }
}

/** The current run; messages and the end of an earlier one are ignored. */
let runSeq = 0;

const cleared = { status: "idle" as ProgramStatus, lines: [] as ProgramLine[], code: null, cut: false, errorKey: null, error: null, stop: null };

export const useProgramStore = create<ProgramState>((set, get) => ({
  projectId: null,
  ...cleared,

  setActiveProject: (projectId) => {
    const s = get();
    if (s.projectId === projectId) return;
    runSeq += 1;
    s.stop?.();
    set({ projectId, ...cleared });
  },

  start: async (projectId) => {
    const transport = getAgentTransport();
    if (!transport) {
      runSeq += 1;
      set({ projectId, ...cleared, status: "failed", errorKey: "noConnection" });
      return null;
    }
    const seq = ++runSeq;
    get().stop?.();
    set({ projectId, ...cleared, status: "starting" });
    const mine = () => seq === runSeq && get().projectId === projectId;
    const onMessage = (m: ServerMessage) => {
      if (!mine() || m.type !== "program_log") return;
      set((s) => ({ status: "running", lines: [...s.lines.slice(-(PROGRAM_LINES_KEPT - 1)), { stream: m.stream, text: m.text }] }));
    };
    try {
      const outcome = await transport.runProgram(projectId, onMessage, (stop) => mine() && set({ stop }));
      if (!mine()) return outcome;
      if (outcome.kind === "done") set({ status: "exited", code: outcome.code, cut: outcome.cut, stop: null });
      else if (outcome.kind === "cancelled") set({ status: "cancelled", stop: null });
      else set({ status: "failed", errorKey: errorKind(outcome), error: outcome.error, stop: null });
      return outcome;
    } catch (err) {
      if (mine()) set({ status: "failed", errorKey: "agentError", error: err instanceof Error ? err.message : String(err), stop: null });
      return null;
    }
  },
}));
