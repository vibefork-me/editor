import { describe, expect, it } from "vitest";
import { applyCanvasEvent, buildCanvasState, initialCanvasState } from "../canvasState.ts";
import { stream } from "../testSessions.ts";
import { drawData, MORE } from "./drawData.ts";
import { nodeRadius } from "./paint.ts";
import { StableGraph, fitZoomLimit, linkPresence, treeCrossings } from "./stableGraph.ts";
import { seeded, syntheticAnalysis } from "./syntheticSession.ts";

const analysisOf = (size: number) => buildCanvasState(syntheticAnalysis(size, size));

/** The layout's own start: every node placed next to its parent, as it appears while the graph grows. */
function grown(size: number) {
  const records = syntheticAnalysis(size, size);
  const stable = new StableGraph(() => 0, seeded(7));
  // Feed the state event by event, so every node is placed next to an already placed parent;
  // the state grows by one event each step instead of being rebuilt from the start.
  let state = initialCanvasState;
  for (const r of records) {
    state = applyCanvasEvent(state, r.ev, r.at);
    stable.sync(drawData(state, new Set(), false));
  }
  return stable;
}

describe("what the canvas draws", () => {
  it("draws the parts and the tree of a small session as is", () => {
    const d = drawData(buildCanvasState(stream));
    expect(d.nodes.map((n) => n.id)).toEqual(["root", "ui", "store", "sync", "fork"]);
    expect(d.nodes.some((n) => n.kind === "more")).toBe(false);
  });

  it("folds a big branch the agent has not been in into +N, and opens it when asked", () => {
    const state = analysisOf(259);
    const folded = drawData(state);
    const more = folded.nodes.filter((n) => n.kind === "more");
    expect(more.length).toBeGreaterThan(0);
    const hiddenCount = more.reduce((acc, n) => acc + Number(n.label.slice(1)), 0);
    expect(folded.nodes.length - more.length + hiddenCount).toBe(259);
    const first = more[0]!;
    const opened = drawData(state, new Set([first.id.replace(MORE, "")]));
    expect(opened.nodes.some((n) => n.id === first.id)).toBe(false);
    // Every link of what is drawn ends at a drawn node.
    const ids = new Set(folded.nodes.map((n) => n.id));
    expect(folded.links.every((l) => ids.has(String(l.source)) && ids.has(String(l.target)))).toBe(true);
  });

  it("keeps the top level and the branches the agent has been in open", () => {
    const state = analysisOf(259);
    const shown = new Set(drawData(state).nodes.map((n) => n.id));
    for (const id of state.visited) expect(shown.has(id)).toBe(true);
    for (const n of Object.values(state.nodes)) if (n.depth <= 1) expect(shown.has(n.id)).toBe(true);
  });
});

describe("layout", () => {
  it("places a new node next to its parent and pins the roots", () => {
    const stable = grown(26);
    const root = stable.nodes.get("root");
    expect(root).toMatchObject({ x: 0, y: 0, fx: 0, fy: 0 });
    const child = [...stable.nodes.values()].find((n) => n.parent === "root" && n.kind !== "project");
    expect(Math.hypot(child?.x ?? 99, child?.y ?? 99)).toBeCloseTo(30, 5);
  });

  it("reports a change only when nodes or links appear or go", () => {
    const stable = new StableGraph(() => 0, seeded(1));
    const state = buildCanvasState(stream);
    expect(stable.sync(drawData(state))).toBe(true);
    expect(stable.sync(drawData(state))).toBe(false);
  });

  for (const size of [26, 259]) {
    it(`tidies a tree of ${size} parts without crossings or piles`, () => {
      const stable = grown(size);
      stable.startRelax();
      for (const n of stable.nodes.values()) {
        const t = stable.targets?.get(n.id);
        if (t) Object.assign(n, t);
      }
      expect(stable.nodes.size).toBe(size);
      expect(treeCrossings(stable.nodes.values(), stable.links.values())).toBe(0);
      // No pile: no two bodies touch. One assertion over all pairs, not one per pair.
      const placed = [...stable.nodes.values()];
      const touching: string[] = [];
      for (let i = 0; i < placed.length; i++)
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i]!;
          const b = placed[j]!;
          if (Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0)) <= nodeRadius(a) + nodeRadius(b)) touching.push(`${a.id}~${b.id}`);
        }
      expect(touching).toEqual([]);
    });
  }

  it("counts crossing tree links", () => {
    const nodes = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 10, y: 10 },
      { id: "c", x: 0, y: 10 },
      { id: "d", x: 10, y: 0 },
    ];
    const link = (s: string, t: string) => ({ id: `${s}->${t}`, source: s, target: t, hierarchy: true, touchCount: 0, lastTouchAt: 0 });
    // treeCrossings reads only ids and positions.
    expect(treeCrossings(nodes as never, [link("a", "b"), link("c", "d")])).toBe(1);
    expect(treeCrossings(nodes as never, [link("a", "c"), link("b", "d")])).toBe(0);
  });

  it("flashes a link the agent walked and lets it fade", () => {
    const link = { id: "a->b", source: "a", target: "b", hierarchy: false, touchCount: 1, lastTouchAt: 1000 };
    expect(linkPresence(link, 1000, [])).toBe(1);
    expect(linkPresence(link, 2250, [])).toBeCloseTo(0.5);
    expect(linkPresence(link, 9000, [])).toBe(0);
    expect(linkPresence(link, 9000, ["b"])).toBe(1);
  });
});

describe("camera", () => {
  it("shows a small graph closer the fewer parts it has, never closer than 2.7× and never limited below 1.5×", () => {
    const limits = [1, 2, 5, 8, 20, 200].map((n) => fitZoomLimit(n, 1440));
    expect(limits[0]).toBeCloseTo(2.7);
    for (let i = 1; i < limits.length; i++) expect(limits[i]).toBeLessThanOrEqual(limits[i - 1]);
    expect(limits[2]).toBeGreaterThan(1.8);
    expect(limits[5]).toBe(1.5);
  });

  it("keeps a small graph at 1.5× on a narrow screen", () => {
    expect(fitZoomLimit(1, 390)).toBe(1.5);
  });
});
