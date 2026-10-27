import type { GraphEdge, GraphNode } from "../client/types.ts";
import { initialCanvasState, type CanvasLink, type CanvasNode, type CanvasState } from "./canvasState.ts";

/** The id of the project root on the canvas, as the agent names it in the session stream. */
export const ROOT = "root";

function node(id: string, label: string, summary: string, parent: string | null, depth: number, piece = false): CanvasNode {
  return {
    id,
    label,
    summary,
    parent,
    kind: !parent ? "project" : piece ? "subsystem" : "part",
    files: [],
    insights: [],
    discoveredAt: 0,
    touchCount: 0,
    lastTouchAt: 0,
    depth,
  };
}

function treeLink(source: string, target: string): CanvasLink {
  return { id: `${source}->${target}`, source, target, hierarchy: true, touchCount: 0, lastTouchAt: 0 };
}

/**
 * The canvas of a project map (`GET /v1/graph`) without a session stream: its parts under the project root,
 * with the ids of the map (the parts of the model's map are `p1`, `p2`… in the stream too). Folders keep
 * their nesting (`from` contains `to`); smaller pieces of a model's part (`p1.1`…, with `parent`) sit
 * inside it, as in the stream; the model's links between parts are links the agent has not moved along
 * yet. Parts that changed since the project was taken are marked changed.
 */
export function mapCanvasState(nodes: GraphNode[], edges: GraphEdge[], folders: boolean, projectLabel: string): CanvasState {
  if (nodes.length === 0) return initialCanvasState;
  const ids = new Set(nodes.map((n) => n.id));
  const root = ids.has(ROOT) ? `${ROOT}:project` : ROOT;
  const parentOf = new Map<string, string>();
  if (folders) for (const e of edges) if (ids.has(e.from) && ids.has(e.to) && e.from !== e.to) parentOf.set(e.to, e.from);
  const pieces = new Set<string>();
  if (!folders) {
    for (const n of nodes) {
      if (n.parent && n.parent !== n.id && ids.has(n.parent)) {
        parentOf.set(n.id, n.parent);
        pieces.add(n.id);
      }
    }
  }

  const state: CanvasState = { ...initialCanvasState, nodes: {}, order: [], links: {}, changed: [] };
  state.nodes[root] = node(root, projectLabel, "", null, 0);
  state.order.push(root);
  // Parents first, so every part comes after the part it is in.
  const depthOf = (id: string, seen = new Set<string>()): number => {
    const p = parentOf.get(id);
    if (!p || seen.has(p)) return 1;
    seen.add(id);
    return depthOf(p, seen) + 1;
  };
  const sorted = [...nodes].sort((a, b) => depthOf(a.id) - depthOf(b.id));
  for (const n of sorted) {
    const parent = parentOf.get(n.id) ?? root;
    state.nodes[n.id] = node(n.id, n.label, n.summary ?? "", parent, depthOf(n.id), pieces.has(n.id));
    state.order.push(n.id);
    const link = treeLink(parent, n.id);
    state.links[link.id] = link;
    if ((n.changed ?? 0) > 0) state.changed.push(n.id);
  }
  if (!folders) {
    for (const e of edges) {
      if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to) continue;
      const id = `${e.from}->${e.to}`;
      if (!state.links[id] && !state.links[`${e.to}->${e.from}`]) {
        state.links[id] = { id, source: e.from, target: e.to, hierarchy: false, touchCount: 0, lastTouchAt: 0 };
      }
    }
  }
  return state;
}

/**
 * The session stream over the map: what the stream says wins; parts of the map the stream has not
 * reported stay on the canvas under their parent (or under the stream's own root).
 */
export function withMap(stream: CanvasState, map: CanvasState): CanvasState {
  if (map.order.length === 0) return stream;
  if (stream.order.length === 0) return { ...stream, nodes: map.nodes, order: map.order, links: map.links, changed: stream.task ? stream.changed : map.changed };
  const streamRoot = stream.order.find((id) => stream.nodes[id]?.kind === "project" && !stream.nodes[id]?.parent) ?? ROOT;
  const mapRoot = map.order[0];
  const missing = map.order.filter((id) => id !== mapRoot && !stream.nodes[id]);
  if (missing.length === 0) return stream;
  const nodes = { ...stream.nodes };
  const links = { ...stream.links };
  for (const id of missing) {
    const n = map.nodes[id]!;
    const parent = !n.parent || n.parent === mapRoot || !nodes[n.parent] ? streamRoot : n.parent;
    nodes[id] = { ...n, parent, depth: (nodes[parent]?.depth ?? 0) + 1 };
    const link = treeLink(parent, id);
    links[link.id] = link;
  }
  return { ...stream, nodes, links, order: [...stream.order, ...missing] };
}
