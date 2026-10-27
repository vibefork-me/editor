/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentTransport } from "../client/types.ts";
import type { CanvasState } from "../canvas/canvasState.ts";
import { useI18nStore } from "../i18n/i18nStore.ts";
import { bindAgentTransport } from "../stores/agent-bridge.ts";
import { useBuildStore } from "../stores/buildStore.ts";
import { LAYOUT_STORAGE_KEY, useLayoutStore } from "../stores/layoutStore.ts";
import { useProjectStore } from "../stores/projectStore.ts";
import { useSessionStore } from "../stores/sessionStore.ts";
import { useViewerStore } from "../stores/viewerStore.ts";

vi.mock("../hooks/useProjectShellSync.ts", () => ({ useProjectShellSync: () => undefined }));
vi.mock("../hooks/useModelLabel.ts", () => ({ useModelLabel: () => ({ name: "Claude", model: "Claude Sonnet" }) }));
// The canvas shows the parts it is given.
vi.mock("../canvas/graph/GraphCanvas.tsx", () => ({
  GraphCanvas: ({ state }: { state: CanvasState }) => (
    <ul data-testid="graph">
      {state.order.map((id) => (
        <li key={id}>{state.nodes[id]?.label}</li>
      ))}
    </ul>
  ),
}));

import { ProjectPage } from "./ProjectPage.tsx";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/demo"]}>
      <Routes>
        <Route path="/:projectId" element={<ProjectPage />} />
        <Route path="/open" element={<div data-testid="open-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectPage shell", () => {
  beforeEach(() => {
    localStorage.clear();
    useLayoutStore.getState().reset();
    useLayoutStore.getState().setJournalTab("agent");
    useViewerStore.getState().resetViewer();
    useBuildStore.getState().resetBuild();
    useI18nStore.getState().setLocale("en");
    useSessionStore.getState().setConnectionStatus("connected");
    useProjectStore.setState({ currentProjectId: "demo", projectMeta: { projectId: "demo", upstream: "owner/notes-app" } });
    bindAgentTransport({
      getCanvas: async () => ({ events: [], next: 1 }),
      getGraph: async () => ({
        nodes: [
          { id: "p1", label: "Editor screen", files: 3, changed: 0 },
          { id: "p2", label: "Note storage", files: 2, changed: 1 },
        ],
        edges: [{ from: "p1", to: "p2" }],
        source: "model",
      }),
      listProjects: async () => [
        { projectId: "demo", upstream: "owner/notes-app" },
        { projectId: "other", upstream: "owner/todo" },
      ],
      readFile: async ({ path }: { path: string }) => ({ path, content: "export {}", binary: false, tooLarge: false, size: 9 }),
    } as unknown as AgentTransport);
  });

  it("has no header: the project plate opens a menu with the connection, projects and settings", async () => {
    renderPage();
    expect(screen.queryByTestId("status-bar")).toBeNull();
    const plate = screen.getByTestId("project-plate");
    expect(plate.textContent).toContain("owner/notes-app");

    fireEvent.click(plate);
    expect(await screen.findByText("Agent is running")).toBeTruthy();
    expect(await screen.findByText("owner/todo")).toBeTruthy();
    expect(screen.getByText("Open another project")).toBeTruthy();
    expect(screen.getByText("AI: Claude")).toBeTruthy();
    // Suggesting changes to the author comes later.
    expect(screen.getByTestId("suggest-to-author").getAttribute("aria-disabled")).toBe("true");
  });

  it("shows and hides the panels from the buttons and with Alt+1..3, and remembers it", () => {
    renderPage();
    expect(screen.queryByTestId("panel-files")).toBeNull();

    fireEvent.click(screen.getByTestId("toggle-files"));
    expect(screen.getByTestId("panel-files")).toBeTruthy();
    expect(screen.getByTestId("toggle-files").getAttribute("aria-pressed")).toBe("true");

    fireEvent.keyDown(window, { key: "3", altKey: true });
    expect(screen.getByTestId("journal-panel")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? "{}").journal.open).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Close Files" }));
    expect(screen.queryByTestId("panel-files")).toBeNull();
  });

  it("resizes a panel by its border and keeps the size within limits", () => {
    useLayoutStore.getState().setOpen("files", true);
    renderPage();
    const handle = screen.getByTestId("resize-files");
    const before = useLayoutStore.getState().panels.files.size;
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(useLayoutStore.getState().panels.files.size).toBe(before + 24);
    act(() => useLayoutStore.getState().setSize("files", 10_000));
    expect(useLayoutStore.getState().panels.files.size).toBe(520);
    expect(JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? "{}").files.size).toBe(520);
  });

  it("opens the code panel when a file is opened, with tabs", async () => {
    renderPage();
    await act(() => useViewerStore.getState().openFile("src/ui/editor.tsx"));
    expect(screen.getByTestId("panel-code")).toBeTruthy();
    await act(() => useViewerStore.getState().openFile("src/store/db.ts"));
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["editor.tsx", "db.ts"]);

    fireEvent.click(screen.getByRole("button", { name: "Close db.ts" }));
    await waitFor(() => expect(useViewerStore.getState().activePath).toBe("src/ui/editor.tsx"));
  });

  it("marks the Journal when the build failed, without opening it", () => {
    renderPage();
    expect(screen.queryByTestId("journal-error-badge")).toBeNull();
    act(() => useBuildStore.setState({ status: "failed", errorKey: "processFailed" }));
    expect(screen.getByTestId("journal-error-badge")).toBeTruthy();
    expect(screen.queryByTestId("journal-panel")).toBeNull();
  });

  it("shows the map of the project without a session stream", async () => {
    renderPage();
    const graph = await screen.findByTestId("graph");
    await waitFor(() => expect([...graph.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["owner/notes-app", "Editor screen", "Note storage"]));
    expect(screen.queryByTestId("empty-canvas")).toBeNull();
  });
});
