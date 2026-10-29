/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialCanvasState } from "../../canvas/canvasState.ts";
import type { ServerMessage } from "../../client/protocol.generated.ts";
import type { AgentTransport, BuildOutcome, ProgramOutcome } from "../../client/types.ts";
import { useI18nStore } from "../../i18n/i18nStore.ts";
import { bindAgentTransport } from "../../stores/agent-bridge.ts";
import { useBuildStore } from "../../stores/buildStore.ts";
import { useLayoutStore } from "../../stores/layoutStore.ts";
import { useProgramStore } from "../../stores/programStore.ts";
import { useProjectStore } from "../../stores/projectStore.ts";
import { JournalPanel } from "./JournalPanel.tsx";

function Journal() {
  return <JournalPanel feed={[]} taskStatus={null} state={initialCanvasState} errors={{ agent: false, build: false, program: false }} />;
}

/** An agent that builds the project and runs its program until stopped, or ends with `outcome`. */
function agent(outcome?: ProgramOutcome) {
  let stopped: (() => void) | null = null;
  const runProgram = vi.fn(
    (_project: string, onMessage: (m: ServerMessage) => void, onStop?: (stop: () => void) => void) =>
      new Promise<ProgramOutcome>((resolve) => {
        onMessage({ type: "program_log", stream: "stdout", text: "Notes ready: 3" });
        if (outcome) return resolve(outcome);
        stopped = () => resolve({ kind: "cancelled" });
        onStop?.(() => stopped?.());
      }),
  );
  const runBuild = vi.fn(async (): Promise<BuildOutcome> => ({ kind: "done", code: 0, artifacts: "dist/notes", files: ["notes"] }));
  return { transport: { runBuild, runProgram } as unknown as AgentTransport, runProgram };
}

describe("Run from the build summary", () => {
  beforeEach(() => {
    useI18nStore.getState().setLocale("en");
    useBuildStore.getState().resetBuild();
    useProgramStore.getState().setActiveProject(null);
    useProjectStore.setState({ currentProjectId: "notes-app", projectMeta: { projectId: "notes-app" }, foreignChanges: null });
    useLayoutStore.getState().setJournalTab("build");
    useLayoutStore.getState().setOpen("journal", false);
  });

  it("is offered once the build is ready; it opens the Journal on Program with the output and Stop", async () => {
    const { transport, runProgram } = agent();
    bindAgentTransport(transport);
    render(<Journal />);
    expect(screen.queryByTestId("build-run")).toBeNull();
    await useBuildStore.getState().startBuild("notes-app");

    fireEvent.click(await screen.findByTestId("build-run"));
    expect(runProgram).toHaveBeenCalledWith("notes-app", expect.any(Function), expect.any(Function));
    expect(useLayoutStore.getState().journalTab).toBe("program");
    expect(useLayoutStore.getState().panels.journal.open).toBe(true);
    expect(await screen.findByText("Notes ready: 3")).toBeTruthy();

    fireEvent.click(screen.getByTestId("program-stop"));
    expect(await screen.findByText("Stopped")).toBeTruthy();
  });

  it("words a program that did not start in the person's language, not the agent's text", async () => {
    useI18nStore.getState().setLocale("ru");
    bindAgentTransport(agent({ kind: "error", error: "cannot start the program: not found", code: "run_failed" }).transport);
    useLayoutStore.getState().setJournalTab("program");
    render(<Journal />);
    fireEvent.click(screen.getByTestId("program-run"));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Программа не запустилась. Соберите проект снова и попробуйте ещё раз.");
  });

  it("an unknown error of the agent gets the general phrase", async () => {
    bindAgentTransport(agent({ kind: "error", error: "something odd", code: "new_code" }).transport);
    useLayoutStore.getState().setJournalTab("program");
    render(<Journal />);
    fireEvent.click(screen.getByTestId("program-run"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Could not run the program."));
  });
});
