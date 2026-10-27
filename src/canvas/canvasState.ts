import type { Artifact, CanvasEvent, CanvasRecord, EtaScope, Offer, Stage } from "../client/protocol.generated.ts";

/** A part of the project on the canvas, as the agent reported it. */
export interface CanvasNode {
  id: string;
  label: string;
  summary: string;
  /** Parent part; for a second root (another version of the project) — the project it is a version of. */
  parent: string | null;
  kind: "project" | "part" | "subsystem";
  files: string[];
  /** What the agent understood about the part, oldest first, without repeats. */
  insights: string[];
  discoveredAt: number;
  touchCount: number;
  lastTouchAt: number;
  depth: number;
}

/** A link between parts: the tree (`hierarchy`) or the agent moving between them. */
export interface CanvasLink {
  id: string;
  source: string;
  target: string;
  hierarchy: boolean;
  touchCount: number;
  lastTouchAt: number;
}

export interface CanvasProgress {
  done: number;
  total: number;
  unit: string;
  eta: number;
  text?: string;
  id?: string;
}

export interface CanvasHistoryItem {
  at: number;
  task: string;
  result: string;
  /** Labels of the parts the task changed. */
  changed: string[];
  artifacts: Artifact[];
}

/** Everything the canvas shows, built from the session stream. Times are Unix milliseconds. */
export interface CanvasState {
  nodes: Record<string, CanvasNode>;
  /** Node ids in the order they were found. */
  order: string[];
  links: Record<string, CanvasLink>;
  focusedId: string | null;
  task: { text: string; nodes: string[]; at: number } | null;
  latestInsight: { nodeId: string; text: string; at: number } | null;
  stage: Stage | null;
  stageStartedAt: number;
  progress: CanvasProgress | null;
  offers: Offer[];
  plan: string[];
  /** Plan step being worked on, from 0; -1 before the first step. */
  step: number;
  checks: { ok: boolean; text: string; at: number }[];
  result: { text: string; detail: string; artifacts: Artifact[] } | null;
  changed: string[];
  failed: string[];
  thinking: { id: string; text: string; since: number } | null;
  eta: { scope: EtaScope; seconds: number; at: number } | null;
  /** Finished tasks of this stream, oldest first. */
  history: CanvasHistoryItem[];
  /** Messages of the person the agent has taken into account. */
  notesTaken: { noteId: string; related: string[]; reply: string; at: number }[];
  /** Parts the agent has been in (looked at, thought about, moved through), first visit first. */
  visited: string[];
  /** The person paused the task; it goes on after resume. */
  paused: boolean;
  /** Files the agent changed in this stream, with their part; the latest change first. */
  changedFiles: { path: string; node: string; at: number }[];
}

export const initialCanvasState: CanvasState = {
  nodes: {},
  order: [],
  links: {},
  focusedId: null,
  task: null,
  latestInsight: null,
  stage: null,
  stageStartedAt: 0,
  progress: null,
  offers: [],
  plan: [],
  step: -1,
  checks: [],
  result: null,
  changed: [],
  failed: [],
  thinking: null,
  eta: null,
  history: [],
  notesTaken: [],
  visited: [],
  paused: false,
  changedFiles: [],
};

function withChangedFiles(list: CanvasState["changedFiles"], node: string, paths: string[], at: number): CanvasState["changedFiles"] {
  if (paths.length === 0) return list;
  return [...paths.map((path) => ({ path, node, at })), ...list.filter((f) => !paths.includes(f.path))];
}

function visit(visited: string[], ...ids: string[]): string[] {
  const added = ids.filter((id) => !visited.includes(id));
  return added.length ? [...visited, ...added] : visited;
}

function withNode(state: CanvasState, node: CanvasNode): Pick<CanvasState, "nodes" | "order"> {
  return {
    nodes: { ...state.nodes, [node.id]: node },
    order: state.nodes[node.id] ? state.order : [...state.order, node.id],
  };
}

function withLink(links: Record<string, CanvasLink>, link: CanvasLink): Record<string, CanvasLink> {
  return { ...links, [link.id]: link };
}

function touched(node: CanvasNode | undefined, at: number): CanvasNode | undefined {
  return node && { ...node, touchCount: node.touchCount + 1, lastTouchAt: at };
}

/** The state after one more event of the stream. */
export function applyCanvasEvent(state: CanvasState, ev: CanvasEvent, at: number): CanvasState {
  let s = state;
  // Thinking lasts until the agent does something; finished progress goes away the same way.
  if (ev.type !== "focus" && ev.type !== "think" && ev.type !== "eta" && s.thinking) s = { ...s, thinking: null };
  if (s.progress && s.progress.done >= s.progress.total && ev.type !== "progress" && ev.type !== "focus") {
    s = { ...s, progress: null };
  }

  switch (ev.type) {
    case "project": {
      const parent = ev.versionOf ?? null;
      s = {
        ...s,
        ...withNode(s, {
          id: ev.id,
          label: ev.label,
          summary: ev.summary,
          parent,
          kind: "project",
          files: ev.files ?? [],
          insights: [],
          discoveredAt: at,
          touchCount: 0,
          lastTouchAt: 0,
          depth: 0,
        }),
      };
      if (parent) {
        // A second root: tied to the original by a version link that is laid out like a tree link.
        const id = `${parent}->${ev.id}`;
        s = { ...s, links: withLink(s.links, { id, source: parent, target: ev.id, hierarchy: true, touchCount: 0, lastTouchAt: 0 }) };
      }
      return s;
    }
    case "found":
    case "subsystem": {
      const depth = (s.nodes[ev.parent]?.depth ?? 0) + 1;
      const id = `${ev.parent}->${ev.id}`;
      return {
        ...s,
        ...withNode(s, {
          id: ev.id,
          label: ev.label,
          summary: ev.summary,
          parent: ev.parent,
          kind: ev.type === "subsystem" ? "subsystem" : "part",
          files: ev.files ?? [],
          insights: [],
          discoveredAt: at,
          touchCount: 0,
          lastTouchAt: 0,
          depth,
        }),
        links: withLink(s.links, { id, source: ev.parent, target: ev.id, hierarchy: true, touchCount: 0, lastTouchAt: 0 }),
      };
    }
    case "focus":
      return { ...s, focusedId: ev.id, visited: visit(s.visited, ev.id) };
    case "touch": {
      const nodes = { ...s.nodes };
      const from = touched(nodes[ev.from], at);
      if (from) nodes[ev.from] = from;
      const to = touched(nodes[ev.to], at);
      if (to) nodes[ev.to] = to;
      const fwd = `${ev.from}->${ev.to}`;
      const existing = s.links[fwd] ?? s.links[`${ev.to}->${ev.from}`];
      const link = existing ?? { id: fwd, source: ev.from, target: ev.to, hierarchy: false, touchCount: 0, lastTouchAt: 0 };
      return {
        ...s,
        nodes,
        links: withLink(s.links, { ...link, touchCount: link.touchCount + 1, lastTouchAt: at }),
        visited: visit(s.visited, ev.from, ev.to),
      };
    }
    case "insight": {
      const node = s.nodes[ev.id];
      const nodes =
        node && !node.insights.includes(ev.text) ? { ...s.nodes, [ev.id]: { ...node, insights: [...node.insights, ev.text] } } : s.nodes;
      return { ...s, nodes, latestInsight: { nodeId: ev.id, text: ev.text, at } };
    }
    case "stage":
      return { ...s, stage: ev.id, stageStartedAt: at, progress: null };
    case "progress":
      return { ...s, progress: { done: ev.done, total: ev.total, unit: ev.unit, eta: ev.eta, text: ev.text ?? undefined, id: ev.id ?? undefined } };
    case "eta":
      return { ...s, eta: { scope: ev.scope, seconds: ev.seconds, at } };
    case "think":
      return { ...s, thinking: { id: ev.id, text: ev.text, since: at }, visited: visit(s.visited, ev.id) };
    case "offers":
      return { ...s, offers: ev.items };
    case "task":
      // A new task starts clean: its own plan, checks and result.
      return {
        ...s,
        task: { text: ev.text, nodes: ev.nodes, at },
        plan: [],
        step: -1,
        checks: [],
        result: null,
        changed: [],
        failed: [],
        paused: false,
      };
    case "plan":
      return { ...s, plan: ev.steps };
    case "step":
      return { ...s, step: ev.index };
    case "change":
      return {
        ...s,
        changed: s.changed.includes(ev.id) ? s.changed : [...s.changed, ev.id],
        failed: s.failed.filter((id) => id !== ev.id),
        changedFiles: withChangedFiles(s.changedFiles, ev.id, ev.files ?? [], at),
      };
    case "check":
      return {
        ...s,
        checks: [...s.checks, { ok: ev.ok, text: ev.text, at }],
        failed: !ev.ok && ev.id && !s.failed.includes(ev.id) ? [...s.failed, ev.id] : s.failed,
      };
    case "paused":
      return { ...s, paused: true };
    case "resumed":
      return { ...s, paused: false };
    case "note.taken":
      return { ...s, notesTaken: [...s.notesTaken, { noteId: ev.noteId, related: ev.related, reply: ev.reply, at }] };
    case "result": {
      const result = { text: ev.text, detail: ev.detail, artifacts: ev.artifacts ?? [] };
      // The finished task joins the history with what it produced; a later result without a new task (a
      // part put back as it was) does not.
      const history = s.task && !s.result
        ? [
            ...s.history,
            {
              at,
              task: s.task.text,
              result: ev.text,
              changed: s.order.filter((id) => s.changed.includes(id)).map((id) => s.nodes[id]?.label ?? id),
              artifacts: result.artifacts,
            },
          ]
        : s.history;
      // Files of the changes the task reports, when the stream did not name them on the way.
      let changedFiles = s.changedFiles;
      for (const a of result.artifacts) {
        if (a.kind !== "changes") continue;
        for (const f of a.files ?? []) {
          if (!changedFiles.some((c) => c.path === f.path)) changedFiles = [...changedFiles, { path: f.path, node: f.node ?? "", at }];
        }
      }
      return { ...s, result, history, paused: false, changedFiles };
    }
  }
}

/** The state after a stream of records, up to `untilAt` (inclusive) when given. */
export function buildCanvasState(records: CanvasRecord[], untilAt?: number): CanvasState {
  let state = initialCanvasState;
  for (const r of records) {
    if (untilAt !== undefined && r.at > untilAt) break;
    state = applyCanvasEvent(state, r.ev, r.at);
  }
  return state;
}

/** A node with what the canvas draws on it now. */
export interface CanvasNodeView extends CanvasNode {
  isFocused: boolean;
  isTaskNode: boolean;
  isChanged: boolean;
  isFailed: boolean;
  isThinking: boolean;
  /** Work on this part: 0..1, -1 when the amount is unknown; null when there is none. */
  progress: number | null;
}

/** Nodes in the order they were found, with their current marks. */
export function canvasNodes(state: CanvasState): CanvasNodeView[] {
  return state.order.flatMap((id) => {
    const node = state.nodes[id];
    if (!node) return [];
    const p = state.progress;
    return [
      {
        ...node,
        isFocused: id === state.focusedId,
        isTaskNode: state.task?.nodes.includes(id) ?? false,
        isChanged: state.changed.includes(id),
        isFailed: state.failed.includes(id),
        isThinking: state.thinking?.id === id,
        progress: p && p.id === id ? (p.unit ? p.done / p.total : -1) : null,
      },
    ];
  });
}

/** Seconds left of the overall estimate at `now`; null when there is none or the task has ended. */
export function etaLeft(state: CanvasState, now: number): { scope: EtaScope; left: number } | null {
  if (!state.eta || state.result) return null;
  return { scope: state.eta.scope, left: Math.max(0, state.eta.seconds - (now - state.eta.at) / 1000) };
}
