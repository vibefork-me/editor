/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "../client/protocol.generated.ts";
import type { AgentTransport, TaskControl } from "../client/types.ts";
import { stream } from "../canvas/testSessions.ts";
import { useI18nStore } from "../i18n/i18nStore.ts";
import { bindAgentTransport } from "../stores/agent-bridge.ts";
import { useProjectStore } from "../stores/projectStore.ts";

vi.mock("../hooks/useProjectShellSync.ts", () => ({ useProjectShellSync: () => undefined }));
vi.mock("../hooks/useModelLabel.ts", () => ({ useModelLabel: () => null }));
vi.mock("../components/viewer/index.ts", () => ({ ViewerLayoutContainer: () => null }));
vi.mock("../canvas/graph/GraphCanvas.tsx", () => ({ GraphCanvas: () => <div data-testid="graph" /> }));

import { ProjectPage } from "./ProjectPage.tsx";

describe("ProjectPage messages on the canvas", () => {
  let onMessage: ((m: ServerMessage) => void) | null = null;
  const control: TaskControl = { stop: vi.fn(), resume: vi.fn(), cancel: vi.fn(), note: vi.fn() };
  const runTask = vi.fn((_params, on: (m: ServerMessage) => void, onControl?: (c: TaskControl) => void) => {
    onMessage = on;
    onControl?.(control);
    return new Promise<never>(() => {});
  });

  beforeEach(() => {
    useI18nStore.getState().setLocale("en");
    useProjectStore.setState({ currentProjectId: "demo", projectMeta: { projectId: "demo" } });
    // The analysis of the notes app only: no task has run yet.
    const analysis = stream.slice(0, 22);
    bindAgentTransport({
      getCanvas: async ({ from }: { from: number }) => ({ events: analysis.filter((r) => r.seq >= from), next: analysis.length + 1 }),
      getGraph: async () => ({ nodes: [], edges: [] }),
      runTask,
    } as unknown as AgentTransport);
  });

  it("starts a task from the field, then sends notes to it; a note the agent did not take says so", async () => {
    render(
      <MemoryRouter initialEntries={["/demo"]}>
        <Routes><Route path="/:projectId" element={<ProjectPage />} /></Routes>
      </MemoryRouter>,
    );
    const field = (await screen.findByLabelText("Message to the agent")) as HTMLTextAreaElement;
    // The old chat field is not shown with the living canvas.
    expect(screen.getAllByRole("textbox")).toHaveLength(1);

    fireEvent.click(screen.getByText("Dark theme"));
    fireEvent.keyDown(field, { key: "Enter" });
    expect(runTask).toHaveBeenCalledWith(expect.objectContaining({ projectId: "demo", prompt: "Add a dark look" }), expect.any(Function), expect.any(Function));
    await waitFor(() => expect(field.placeholder).toBe("Tell the agent — it reads it after the current step"));

    fireEvent.change(field, { target: { value: "Keep the toggle in the settings" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(control.note).toHaveBeenCalledWith("Keep the toggle in the settings", []);
    expect(runTask).toHaveBeenCalledTimes(1);
    const note = () => screen.getAllByTestId("person-message")[1]!;
    expect(note().dataset.status).toBe("waiting");

    act(() => onMessage?.({ type: "error", error: "not supported by this version of the agent", code: "not_supported" }));
    expect(note().dataset.status).toBe("failed");
  });
});
