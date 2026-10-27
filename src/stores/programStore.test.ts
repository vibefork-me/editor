import { beforeEach, describe, expect, it } from "vitest";
import type { ServerMessage } from "../client/protocol.generated.ts";
import type { AgentTransport, ProgramOutcome } from "../client/types.ts";
import { bindAgentTransport } from "./agent-bridge.ts";
import { PROGRAM_LINES_KEPT, programFailed, useProgramStore } from "./programStore.ts";

/** An agent whose program prints `lines` and ends with `outcome`. */
function agent(lines: ServerMessage[], outcome: ProgramOutcome): AgentTransport {
  return {
    runProgram: async (_project: string, onMessage: (m: ServerMessage) => void, onStop?: (stop: () => void) => void) => {
      onStop?.(() => {});
      for (const m of lines) onMessage(m);
      return outcome;
    },
  } as unknown as AgentTransport;
}

describe("program store", () => {
  beforeEach(() => {
    useProgramStore.getState().setActiveProject(null);
  });

  it("keeps the output by stream and the exit code; a non-zero exit is an error", async () => {
    bindAgentTransport(
      agent(
        [
          { type: "program_log", stream: "stdout", text: "notes: 3" },
          { type: "program_log", stream: "stderr", text: "no config" },
        ],
        { kind: "done", code: 1, cut: true },
      ),
    );
    await useProgramStore.getState().start("notes-app");
    const s = useProgramStore.getState();
    expect(s.lines).toEqual([
      { stream: "stdout", text: "notes: 3" },
      { stream: "stderr", text: "no config" },
    ]);
    expect([s.status, s.code, s.cut, s.stop]).toEqual(["exited", 1, true, null]);
    expect(programFailed(s)).toBe(true);
  });

  it("a clean exit and a stop are not errors; a refused run is", async () => {
    bindAgentTransport(agent([], { kind: "done", code: 0, cut: false }));
    await useProgramStore.getState().start("notes-app");
    expect(programFailed(useProgramStore.getState())).toBe(false);
    bindAgentTransport(agent([], { kind: "cancelled" }));
    await useProgramStore.getState().start("notes-app");
    expect(useProgramStore.getState().status).toBe("cancelled");
    expect(programFailed(useProgramStore.getState())).toBe(false);
    bindAgentTransport(agent([], { kind: "error", error: "run not confirmed", code: "run_not_confirmed" }));
    await useProgramStore.getState().start("notes-app");
    expect(useProgramStore.getState().errorKey).toBe("notConfirmed");
    expect(programFailed(useProgramStore.getState())).toBe(true);
  });

  it("keeps only the latest lines", async () => {
    const many: ServerMessage[] = Array.from({ length: PROGRAM_LINES_KEPT + 5 }, (_, i) => ({ type: "program_log", stream: "stdout", text: `line ${i}` }));
    bindAgentTransport(agent(many, { kind: "done", code: 0, cut: false }));
    await useProgramStore.getState().start("notes-app");
    const { lines } = useProgramStore.getState();
    expect(lines).toHaveLength(PROGRAM_LINES_KEPT);
    expect(lines[0]!.text).toBe("line 5");
  });

  it("another project drops the output of the previous one", async () => {
    bindAgentTransport(agent([{ type: "program_log", stream: "stdout", text: "x" }], { kind: "done", code: 2, cut: false }));
    await useProgramStore.getState().start("notes-app");
    useProgramStore.getState().setActiveProject("todo");
    expect(useProgramStore.getState()).toMatchObject({ projectId: "todo", status: "idle", lines: [] });
  });
});
