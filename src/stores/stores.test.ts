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

  it("labels other node with empty label as Everything else / Остальное", async () => {
    bindAgentTransport({
      getGraph: vi.fn(async () => ({
        source: "model" as const,
        revision: "rev-other",
        nodes: [
          { id: "p1", label: "Core", files: 3, changed: 0 },
          { id: "other", label: "", files: 2, changed: 0 },
        ],
        edges: [],
      })),
    } as unknown as AgentTransport);

    await useGraphStore.getState().loadGraph("proj-other");
    const otherNode = useGraphStore.getState().nodes.get("other");
    expect(otherNode).toBeTruthy();
    expect(otherNode?.label).toMatch(/everything else|остальное/i);
  });

  it("isolates cache between projects on A -> B -> Folders -> Parts", async () => {
    let projBDescribeCount = 0;
    bindAgentTransport({
      getGraph: vi.fn(async ({ projectId }: { projectId: string; view?: string }) => {
        if (projectId === "project-a") {
          return {
            source: "model" as const,
            revision: "rev-a",
            nodes: [{ id: "p-a", label: "Part A", files: 5, changed: 0 }],
            edges: [],
          };
        }
        if (projectId === "project-b") {
          // Project B starts with folders
          return {
            source: "folders" as const,
            revision: "rev-b-folders",
            nodes: [{ id: "b-dir", label: "src", files: 8, changed: 0 }],
            edges: [],
          };
        }
        return { source: "folders" as const, revision: "0", nodes: [], edges: [] };
      }),
      describeGraph: vi.fn(async ({ projectId }: { projectId: string }) => {
        if (projectId === "project-b") {
          projBDescribeCount++;
          return {
            source: "model" as const,
            revision: "rev-b-model",
            nodes: [{ id: "p-b", label: "Part B", files: 8, changed: 0 }],
            edges: [],
          };
        }
        throw new Error("unexpected describe call");
      }),
    } as unknown as AgentTransport);

    // 1. Open Project A (has model map)
    await useProjectStore.getState().selectProject("project-a");
    expect(useGraphStore.getState().source).toBe("model");
    expect(useGraphStore.getState().nodes.get("p-a")?.label).toBe("Part A");

    // 2. Open Project B (source is folders -> auto-describes to model map)
    await useProjectStore.getState().selectProject("project-b");
    expect(useGraphStore.getState().source).toBe("model");
    expect(useGraphStore.getState().nodes.get("p-b")?.label).toBe("Part B");
    expect(useGraphStore.getState().nodes.has("p-a")).toBe(false);
    expect(projBDescribeCount).toBe(1);

    // 3. Switch to Folders in Project B
    await useGraphStore.getState().setView("folders");
    expect(useGraphStore.getState().currentView).toBe("folders");
    expect(useGraphStore.getState().nodes.get("b-dir")?.label).toBe("src");

    // 4. Switch back to Parts in Project B (must use Project B's parts, never Project A's)
    await useGraphStore.getState().setView("parts");
    expect(useGraphStore.getState().currentView).toBe("parts");
    expect(useGraphStore.getState().nodes.get("p-b")?.label).toBe("Part B");
    expect(useGraphStore.getState().nodes.has("p-a")).toBe(false);
  });

  it("discards slow describeGraph response from Project A when switched to Project B", async () => {
    let resolveProjADescribe!: (val: unknown) => void;
    const projADescribePromise = new Promise((resolve) => {
      resolveProjADescribe = resolve;
    });

    bindAgentTransport({
      getGraph: vi.fn(async ({ projectId }: { projectId: string; view?: string }) => {
        if (projectId === "project-a") {
          return {
            source: "folders" as const,
            revision: "rev-a-folders",
            nodes: [{ id: "dir-a", label: "src-a", files: 2, changed: 0 }],
            edges: [],
          };
        }
        if (projectId === "project-b") {
          return {
            source: "model" as const,
            revision: "rev-b-model",
            nodes: [{ id: "p-b", label: "Part B", files: 10, changed: 0 }],
            edges: [],
          };
        }
        return { source: "folders" as const, revision: "0", nodes: [], edges: [] };
      }),
      describeGraph: vi.fn(async ({ projectId }: { projectId: string }) => {
        if (projectId === "project-a") {
          return projADescribePromise;
        }
        throw new Error(`unexpected describe call for ${projectId}`);
      }),
    } as unknown as AgentTransport);

    // 1. Select Project A. It starts loading folders, triggers describeGraph (which hangs).
    const projAPromise = useProjectStore.getState().selectProject("project-a");
    // Wait microtasks so getGraph finishes and describeGraph is initiated
    await new Promise((r) => setTimeout(r, 10));

    expect(useGraphStore.getState().isDescribing).toBe(true);
    expect(useGraphStore.getState().currentProjectId).toBe("project-a");

    // 2. User switches to Project B before Project A's describe finishes.
    await useProjectStore.getState().selectProject("project-b");

    expect(useGraphStore.getState().currentProjectId).toBe("project-b");
    expect(useGraphStore.getState().source).toBe("model");
    expect(useGraphStore.getState().nodes.has("p-b")).toBe(true);
    expect(useGraphStore.getState().nodes.has("dir-a")).toBe(false);
    expect(useGraphStore.getState().isDescribing).toBe(false);

    // 3. Now Project A's describeGraph finally resolves
    resolveProjADescribe({
      source: "model" as const,
      revision: "rev-a-model",
      nodes: [{ id: "p-a-model", label: "Part A Model", files: 5, changed: 0 }],
      edges: [],
    });
    // Wait for promise chain
    await projAPromise;
    await new Promise((r) => setTimeout(r, 10));

    // 4. Verify Project B state: Project A's model data must NOT have leaked into Project B
    expect(useGraphStore.getState().currentProjectId).toBe("project-b");
    expect(useGraphStore.getState().nodes.has("p-a-model")).toBe(false);
    expect(useGraphStore.getState().nodes.has("p-b")).toBe(true);
    expect(useGraphStore.getState().isDescribing).toBe(false);
    expect(
      useGraphStore.getState().partsMap?.nodes.some((n: { id: string }) => n.id === "p-a-model"),
    ).toBe(false);
  });
});
