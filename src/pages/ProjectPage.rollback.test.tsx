/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "../client/protocol.generated.ts";
import { AgentApiError, type AgentTransport, type RollbackPartOutcome } from "../client/types.ts";
import type { CanvasState } from "../canvas/canvasState.ts";
import { useI18nStore } from "../i18n/i18nStore.ts";
import { bindAgentTransport } from "../stores/agent-bridge.ts";
import { useProjectStore } from "../stores/projectStore.ts";

vi.mock("../hooks/useProjectShellSync.ts", () => ({ useProjectShellSync: () => undefined }));
vi.mock("../hooks/useModelLabel.ts", () => ({ useModelLabel: () => null }));
vi.mock("../components/viewer/index.ts", () => ({ ViewerLayoutContainer: () => null }));
// The canvas lists its parts; a click selects one.
vi.mock("../canvas/graph/GraphCanvas.tsx", () => ({
  GraphCanvas: ({ state, onSelect }: { state: CanvasState; onSelect: (id: string) => void }) => (
    <ul data-testid="graph">
      {state.order.map((id) => (
        <li key={id}>
          <button type="button" onClick={() => onSelect(id)}>
            {state.nodes[id]?.label}
          </button>
        </li>
      ))}
    </ul>
  ),
}));

import { ProjectPage } from "./ProjectPage.tsx";

describe("ProjectPage rollback", () => {
  let finishPart: ((o: RollbackPartOutcome) => void) | null = null;
  let finishRestore: ((ok: boolean) => void) | null = null;
  const getGraph = vi.fn(async () => ({
    nodes: [
      { id: "editor", label: "Editor screen", files: 3, changed: 1 },
      { id: "store", label: "Note storage", files: 2, changed: 0 },
    ],
    edges: [],
    source: "model",
  }));
  const getJournal = vi.fn(async () => ({
    entries: [
      { at: "2026-01-02T10:00:00Z", provider: "claude", model: "m", prompt: "Add tags to notes", commit: "aaa1111" },
      { at: "2026-01-03T10:00:00Z", provider: "claude", model: "m", prompt: "Add a dark theme", commit: "bbb2222" },
    ],
  }));
  const rollbackPart = vi.fn(
    (_p: { projectId: string; id: string }, _on: (m: ServerMessage) => void) =>
      new Promise<RollbackPartOutcome>((resolve) => (finishPart = resolve)),
  );
  const rollback = vi.fn(
    (p: { projectId: string; commit: string }) =>
      new Promise((resolve, reject) => {
        finishRestore = (ok) =>
          ok
            ? resolve({ project: p.projectId, commit: p.commit })
            : reject(new AgentApiError("rollback not confirmed", 403, { code: "rollback_not_confirmed" }));
      }),
  );

  beforeEach(() => {
    useI18nStore.getState().setLocale("en");
    useProjectStore.setState({ currentProjectId: "demo", projectMeta: { projectId: "demo", upstream: "owner/notes-app" } });
    getGraph.mockClear();
    getJournal.mockClear();
    rollbackPart.mockClear();
    rollback.mockClear();
    bindAgentTransport({
      getCanvas: async () => ({ events: [], next: 1 }),
      getGraph,
      getJournal,
      rollbackPart,
      rollback,
      runTask: () => new Promise(() => {}),
      listProjects: async () => [],
    } as unknown as AgentTransport);
  });

  const page = () =>
    render(
      <MemoryRouter initialEntries={["/demo"]}>
        <Routes>
          <Route path="/:projectId" element={<ProjectPage />} />
        </Routes>
      </MemoryRouter>,
    );

  it("puts a part back from its card: confirm in the agent's window, then why not or done with the map read again", async () => {
    page();
    fireEvent.click(await screen.findByRole("button", { name: "Note storage" }));
    const card = await screen.findByTestId("part-callout");
    fireEvent.click(within(card).getByRole("button", { name: "Put it back as it was" }));
    expect(rollbackPart).toHaveBeenCalledWith({ projectId: "demo", id: "store" }, expect.any(Function));
    expect(within(card).getByRole("status").textContent).toBe("Confirm in the agent's window");
    expect((within(card).getByRole("button", { name: "Put it back as it was" }) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => finishPart!({ kind: "error", error: "nothing to roll back", code: "nothing_to_roll_back" }));
    expect(within(card).getByRole("status").textContent).toBe("Nothing to put back: the agent has not changed this part");

    fireEvent.click(within(card).getByRole("button", { name: "Put it back as it was" }));
    const graphReads = getGraph.mock.calls.length;
    await act(async () => finishPart!({ kind: "done" }));
    expect(within(card).getByRole("status").textContent).toBe("The part is back as it was");
    await waitFor(() => expect(getGraph.mock.calls.length).toBeGreaterThan(graphReads));
  });

  it("restores a version from the history; the newest one is the current version", async () => {
    page();
    await waitFor(() => expect(getJournal).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId("project-plate"));
    fireEvent.click(await screen.findByText("History of changes"));
    const history = await screen.findByTestId("history-panel");
    const restore = within(history).getAllByRole("button", { name: "Restore this version" });
    // The dark theme is the version the project is at: only the earlier one can be restored.
    expect(restore).toHaveLength(1);
    expect(within(history).getByText("now")).toBeTruthy();

    fireEvent.click(restore[0]!);
    expect(rollback).toHaveBeenCalledWith({ projectId: "demo", commit: "aaa1111" });
    expect(within(history).getByRole("status").textContent).toBe("Confirm in the agent's window");
    await act(async () => finishRestore!(false));
    expect(within(history).getByRole("status").textContent).toBe("Cancelled in the agent's window; nothing changed");

    fireEvent.click(within(history).getByRole("button", { name: "Restore this version" }));
    const journalReads = getJournal.mock.calls.length;
    await act(async () => finishRestore!(true));
    expect(within(history).getByRole("status").textContent).toBe("The project is back at this version");
    await waitFor(() => expect(getJournal.mock.calls.length).toBeGreaterThan(journalReads));
  });

  it("has no rollback while a task runs", async () => {
    page();
    const field = await screen.findByLabelText("Message to the agent");
    fireEvent.change(field, { target: { value: "Add a dark theme" } });
    fireEvent.keyDown(field, { key: "Enter" });
    fireEvent.click(await screen.findByRole("button", { name: "Note storage" }));
    const card = await screen.findByTestId("part-callout");
    expect(within(card).queryByRole("button", { name: "Put it back as it was" })).toBeNull();
  });
});
