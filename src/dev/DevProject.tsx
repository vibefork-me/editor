import { useEffect, useMemo } from "react";
import { Route, Routes } from "react-router-dom";
import { syntheticAnalysis } from "../canvas/graph/syntheticSession.ts";
import { stream as notesSession } from "../canvas/testSessions.ts";
import type { CanvasRecord, GraphResponse } from "../client/protocol.generated.ts";
import type { AgentTransport } from "../client/types.ts";
import { AgentClientContext } from "../client/react/AgentClientContext.ts";
import { ProjectPage } from "../pages/ProjectPage.tsx";
import { useLayoutStore, type PanelId } from "../stores/layoutStore.ts";
import { useSessionStore } from "../stores/sessionStore.ts";
import { useViewerStore } from "../stores/viewerStore.ts";

/** The map a made-up session describes, as `GET /v1/graph` would answer it: its parts, without the project root. */
export function graphOf(records: CanvasRecord[]): GraphResponse {
  const nodes: GraphResponse["nodes"] = [];
  const edges: GraphResponse["edges"] = [];
  for (const { ev } of records) {
    if (ev.type === "found" || ev.type === "subsystem") {
      nodes.push({ id: ev.id, label: ev.label, summary: ev.summary, files: ev.files?.length ?? 0, changed: 0 });
      if (ev.parent !== "root") edges.push({ from: ev.parent, to: ev.id });
    }
  }
  return { nodes, edges, source: "model", revision: "dev" };
}

const sample = (path: string, theme: string) =>
  [`// ${path}`, "", "export const settings = {", `  theme: "${theme}",`, "  fontSize: 14,", "};", "", "export function apply() {", "  return settings;", "}", ""].join("\n");

/** A made-up agent: answers from a made-up session, never runs anything. */
function devTransport(records: CanvasRecord[], withStream: boolean): AgentTransport {
  const never = () => new Promise<never>(() => {});
  const graph = graphOf(records);
  const events = withStream ? records : [];
  return {
    getHealth: async () => ({ ok: true }),
    listProjects: async () => [
      { projectId: "notes-app", upstream: "example/notes-app" },
      { projectId: "todo", upstream: "example/todo" },
    ],
    getProject: async (projectId: string) => ({ projectId, upstream: "example/notes-app" }),
    getCanvas: async ({ from }: { from: number }) => ({ events: events.filter((r) => r.seq >= from), next: events.length + 1 }),
    getGraph: async () => graph,
    describeGraph: async () => graph,
    // The files of the parts, and some no part lists.
    listFiles: async () => ({
      files: [...new Set(records.flatMap(({ ev }) => (ev.type === "found" || ev.type === "subsystem" ? (ev.files ?? []) : [])))].concat("README.md", "package.json"),
      truncated: false,
    }),
    readFile: async ({ path }: { path: string }) => ({ path, content: sample(path, "light"), binary: false, tooLarge: false, size: 120 }),
    readDiff: async ({ path }: { path: string }) => ({ path, original: sample(path, "light"), modified: sample(path, "dark"), binary: false, tooLarge: false }),
    getModels: async () => [{ provider: "claude", model: "sonnet", label: "Claude Sonnet", cost: "", tier: 0 }],
    runTask: never,
    runBuild: never,
  } as unknown as AgentTransport;
}

declare global {
  interface Window {
    /** The developer project page is ready for headless checks. */
    __vfDevProject?: { parts: number };
  }
}

/**
 * Developer view of the project page on a made-up agent (`/dev/notes-app?session=notes`, or `?size=259`;
 * `&stream=0` — the map without a session stream; `&panels=files,code,journal`; `&file=<path>` opens a file,
 * `&diff=1` with its changes). Exists in development builds only.
 */
export default function DevProject() {
  const params = new URLSearchParams(window.location.search);
  const size = Number(params.get("size") ?? 26);
  const notes = params.get("session") === "notes";
  const withStream = params.get("stream") !== "0";
  const records = useMemo(() => (notes ? notesSession : syntheticAnalysis(size, Number(params.get("seed") ?? 1), 1)), [notes, size]);
  const transport = useMemo(() => devTransport(records, withStream), [records, withStream]);

  useEffect(() => {
    useSessionStore.getState().setBearerToken("dev");
    const panels = (params.get("panels") ?? "").split(",").filter(Boolean) as PanelId[];
    if (params.has("panels")) for (const id of ["files", "code", "journal"] as PanelId[]) useLayoutStore.getState().setOpen(id, panels.includes(id));
    const file = params.get("file");
    if (file) setTimeout(() => void (params.get("diff") === "1" ? useViewerStore.getState().openDiff(file) : useViewerStore.getState().openFile(file)), 300);
    window.__vfDevProject = { parts: graphOf(records).nodes.length };
    // Set up once per page load.
  }, []);

  return (
    <AgentClientContext.Provider value={transport}>
      <Routes>
        <Route path="/dev/:projectId" element={<ProjectPage />} />
      </Routes>
    </AgentClientContext.Provider>
  );
}
