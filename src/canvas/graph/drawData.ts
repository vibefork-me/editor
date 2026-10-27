import { canvasNodes, type CanvasNodeView, type CanvasState } from "../canvasState.ts";

/** A node as the 2D canvas draws it; `x`/`y`/`v*`/`f*` belong to the layout. */
export interface DrawNode extends Omit<CanvasNodeView, "kind"> {
  kind: CanvasNodeView["kind"] | "more";
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

export interface DrawLink {
  id: string;
  source: string | DrawNode;
  target: string | DrawNode;
  hierarchy: boolean;
  touchCount: number;
  lastTouchAt: number;
}

export interface DrawData {
  nodes: DrawNode[];
  links: DrawLink[];
}

/** Id of the folded rest of a branch: `<parent>::more`. */
export const MORE = "::more";
/** A branch with more children than this stays folded until the agent or the person opens it. */
const FOLD_OVER = 3;

export const linkEnd = (v: string | DrawNode) => (typeof v === "string" ? v : v.id);

/**
 * What the canvas draws for a state. A branch with many children is folded into one "+N" node until the
 * agent has been anywhere inside it or the person opened it (`expanded`); the top level is always open.
 * `fold: false` draws every part.
 */
export function drawData(state: CanvasState, expanded: ReadonlySet<string> = new Set(), fold = true): DrawData {
  const nodes: DrawNode[] = canvasNodes(state);
  const links: DrawLink[] = Object.values(state.links).map((l) => ({ ...l }));
  if (!fold) return { nodes, links };
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.parent || n.kind === "project") continue;
    children.set(n.parent, [...(children.get(n.parent) ?? []), n.id]);
  }
  const open = new Set(expanded);
  for (const v of state.visited) {
    open.add(v);
    let p = byId.get(v)?.parent;
    while (p && !open.has(p)) {
      open.add(p);
      p = byId.get(p)?.parent;
    }
  }
  const hidden = new Set<string>();
  const hideBelow = (id: string) => {
    for (const c of children.get(id) ?? []) {
      hidden.add(c);
      hideBelow(c);
    }
  };
  const extraNodes: DrawNode[] = [];
  const extraLinks: DrawLink[] = [];
  for (const n of nodes) {
    const kids = children.get(n.id) ?? [];
    if (n.depth < 1 || kids.length <= FOLD_OVER || open.has(n.id) || hidden.has(n.id)) continue;
    const before = hidden.size;
    hideBelow(n.id);
    const id = n.id + MORE;
    extraNodes.push({
      ...n,
      id,
      label: `+${hidden.size - before}`,
      summary: "",
      kind: "more",
      parent: n.id,
      depth: n.depth + 1,
      files: [],
      insights: [],
      isFocused: false,
      isTaskNode: false,
      isChanged: false,
      isFailed: false,
      isThinking: false,
      progress: null,
      touchCount: 0,
      lastTouchAt: 0,
    });
    extraLinks.push({ id: `${n.id}->${id}`, source: n.id, target: id, hierarchy: true, touchCount: 0, lastTouchAt: 0 });
  }
  if (hidden.size === 0) return { nodes, links };
  return {
    nodes: [...nodes.filter((n) => !hidden.has(n.id)), ...extraNodes],
    links: [...links.filter((l) => !hidden.has(linkEnd(l.source)) && !hidden.has(linkEnd(l.target))), ...extraLinks],
  };
}
