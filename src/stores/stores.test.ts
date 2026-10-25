// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentTransport, GraphSnapshot } from "../client/types.ts";
import { bindAgentTransport } from "./agent-bridge.ts";
import {
  useGraphStore,
  useProjectStore,
  useSessionStore,
  useTaskStore,
  useViewerStore,
} from "./index.ts";

const snapshot = (revision: number, nodeId = "n1"): GraphSnapshot => ({
  revision,
  nodes: [{ id: nodeId, label: `Node ${revision}`, status: "exploring" }],
  edges: [],
  focus: nodeId,
  phase: "exploring",
});

describe("Zustand stores", () => {
  beforeEach(() => {
    useSessionStore.setState({
      bearerToken: null,
      connectionStatus: "disconnected",
      lastError: null,
    });
    useGraphStore.getState().resetGraph();
    useTaskStore.getState().resetTask();
    useViewerStore.getState().resetViewer();
    useProjectStore.setState({
      currentProjectId: null,
      projectMeta: null,
      grantedProjects: [],
      isLoading: false,
    });
    bindAgentTransport(null);
    localStorage.clear();
    sessionStorage.clear();
  });

  it("ignores graph snapshots with revision less than or equal to current", () => {
    useGraphStore.getState().applySnapshot(snapshot(2));
    useGraphStore.getState().applySnapshot(snapshot(2));
    useGraphStore.getState().applySnapshot(snapshot(1));

    expect(useGraphStore.getState().revision).toBe(2);
    expect(useGraphStore.getState().nodes.size).toBe(1);
    expect(useGraphStore.getState().nodes.get("n1")?.label).toBe("Node 2");
  });

  it("updates GraphStore without an active task", () => {
    expect(useTaskStore.getState().activeTaskId).toBeNull();
    useGraphStore.getState().applySnapshot(snapshot(1));
    expect(useGraphStore.getState().revision).toBe(1);
    expect(useTaskStore.getState().activeTaskId).toBeNull();
  });

  it("clears graph, task, and viewer state when selecting another project", async () => {
    bindAgentTransport({
      readFile: vi.fn(async () => ({
        path: "src/main.ts",
        size: 21,
        tooLarge: false,
        binary: false,
        content: "secret from project-a",
      })),
      readDiff: vi.fn(async () => ({
        path: "src/main.ts",
        tooLarge: false,
        binary: false,
        original: "a",
        modified: "b",
      })),
    } as unknown as AgentTransport);

    await useProjectStore.getState().selectProject("project-a");
    useGraphStore.getState().applySnapshot(snapshot(3, "a-node"));
    useTaskStore.getState().setActiveTask("task-a");
    useTaskStore.getState().setGapDetected(true);
    await useViewerStore.getState().openFile("src/main.ts");

    await useProjectStore.getState().selectProject("project-b");

    expect(useProjectStore.getState().currentProjectId).toBe("project-b");
    expect(useGraphStore.getState().revision).toBe(0);
    expect(useGraphStore.getState().nodes.size).toBe(0);
    expect(useTaskStore.getState().activeTaskId).toBeNull();
    expect(useTaskStore.getState().isGapDetected).toBe(false);
    expect(useViewerStore.getState().isOpen).toBe(false);
    expect(useViewerStore.getState().content).toBeNull();
  });

  it("does not persist store data in web storage APIs", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    useSessionStore.getState().setBearerToken("in-memory-only");
    useSessionStore.getState().setConnectionStatus("connected");
    useGraphStore.getState().applySnapshot(snapshot(5));
    useTaskStore.getState().setActiveTask("task-1");
    await useProjectStore.getState().selectProject("demo");

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);

    setItem.mockRestore();
  });

  it("handles too-large, binary, forbidden, and missing diff sides in viewerStore", async () => {
    await useProjectStore.getState().selectProject("demo");

    // too-large file
    bindAgentTransport({
      readFile: vi.fn(async () => ({
        path: "big.dat",
        size: 3000000,
        tooLarge: true,
        binary: false,
        content: null,
      })),
      readDiff: vi.fn(),
    } as unknown as AgentTransport);
    await useViewerStore.getState().openFile("big.dat");
    expect(useViewerStore.getState().isTooLarge).toBe(true);
    expect(useViewerStore.getState().content).toBeNull();

    // binary file
    bindAgentTransport({
      readFile: vi.fn(async () => ({
        path: "image.png",
        size: 1024,
        tooLarge: false,
        binary: true,
        content: null,
      })),
      readDiff: vi.fn(),
    } as unknown as AgentTransport);
    await useViewerStore.getState().openFile("image.png");
    expect(useViewerStore.getState().isBinary).toBe(true);

    // forbidden file (403)
    const forbiddenErr = new Error("this file is not shown");
    (forbiddenErr as { status?: number }).status = 403;
    bindAgentTransport({
      readFile: vi.fn(async () => {
        throw forbiddenErr;
      }),
      readDiff: vi.fn(),
    } as unknown as AgentTransport);
    await useViewerStore.getState().openFile(".env");
    expect(useViewerStore.getState().isForbidden).toBe(true);
    expect(useViewerStore.getState().error).toBeNull();

    // diff with missing sides
    bindAgentTransport({
      readFile: vi.fn(),
      readDiff: vi.fn(async () => ({
        path: "new.ts",
        tooLarge: false,
        binary: false,
        original: null,
        modified: "console.log(1);",
      })),
    } as unknown as AgentTransport);
    await useViewerStore.getState().openDiff("new.ts");
    expect(useViewerStore.getState().diffOriginal).toBe("");
    expect(useViewerStore.getState().diffModified).toBe("console.log(1);");
  });

  it("loads graph on selectProject and auto-describes if source is folders in parts view", async () => {
    let describeCalled = false;
    bindAgentTransport({
      getGraph: vi.fn(async ({ view }: { view?: string }) => {
        if (view === "folders") {
          return {
            source: "folders" as const,
            revision: "rev-1",
            nodes: [{ id: "src", label: "src", files: 10, changed: 0 }],
            edges: [],
          };
        }
        // First call returns folders (not yet described by model)
        if (!describeCalled) {
          return {
            source: "folders" as const,
            revision: "rev-1",
            nodes: [{ id: "src", label: "src", files: 10, changed: 0 }],
            edges: [],
          };
        }
        return {
          source: "model" as const,
          revision: "rev-2",
          nodes: [{ id: "p1", label: "Auth", files: 5, changed: 1, summary: "User auth" }],
          edges: [],
        };
      }),
      describeGraph: vi.fn(async () => {
        describeCalled = true;
        return {
          source: "model" as const,
          revision: "rev-2",
          nodes: [{ id: "p1", label: "Auth", files: 5, changed: 1, summary: "User auth" }],
          edges: [],
        };
      }),
    } as unknown as AgentTransport);

    await useProjectStore.getState().selectProject("demo-proj");
    expect(useGraphStore.getState().currentView).toBe("parts");
    expect(useGraphStore.getState().source).toBe("model");
    expect(useGraphStore.getState().nodes.get("p1")?.status).toBe("changed");
    expect(useGraphStore.getState().nodes.get("p1")?.summary).toBe("User auth");

    // Toggle to folders
    await useGraphStore.getState().setView("folders");
    expect(useGraphStore.getState().currentView).toBe("folders");
    expect(useGraphStore.getState().source).toBe("folders");
    expect(useGraphStore.getState().nodes.get("src")?.status).toBe("unchanged");

    // Toggle back to parts
    await useGraphStore.getState().setView("parts");
    expect(useGraphStore.getState().currentView).toBe("parts");
    expect(useGraphStore.getState().source).toBe("model");
  });

  it("refreshes graph snapshot and updates node statuses", async () => {
    let callCount = 0;
    bindAgentTransport({
      getGraph: vi.fn(async () => {
        callCount++;
        return {
          source: "model" as const,
          revision: `rev-${callCount}`,
          nodes: [
            { id: "p1", label: "Core", files: 4, changed: callCount > 1 ? 2 : 0, summary: "Core logic" },
          ],
          edges: [],
        };
      }),
    } as unknown as AgentTransport);

    await useGraphStore.getState().loadGraph("proj-refresh");
    expect(useGraphStore.getState().nodes.get("p1")?.status).toBe("unchanged");

    await useGraphStore.getState().refreshGraph();
    expect(useGraphStore.getState().nodes.get("p1")?.status).toBe("changed");
    expect(useGraphStore.getState().nodes.get("p1")?.changed).toBe(2);
  });
});
