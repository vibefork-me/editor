import { describe, expect, it } from "vitest";
import { applyCanvasEvent, buildCanvasState, canvasNodes, etaLeft, initialCanvasState } from "./canvasState.ts";
import { after, stream } from "./testSessions.ts";

const at = (n: number) => buildCanvasState(stream, after(n));
const node = (n: number, id: string) => canvasNodes(at(n)).find((x) => x.id === id);

describe("canvas state: analysis", () => {
  it("shows download progress until it is complete and the next stage starts", () => {
    expect(at(3).progress).toMatchObject({ done: 2_097_152, total: 4_194_304, unit: "bytes" });
    expect(at(4).progress?.done).toBe(4_194_304);
    expect(at(5).progress).toBeNull();
    expect(at(5).stage).toBe("parts");
  });

  it("builds the tree of parts in the order they were found", () => {
    const s = at(10);
    expect(canvasNodes(s).map((n) => [n.id, n.parent, n.kind, n.depth])).toEqual([
      ["root", null, "project", 0],
      ["ui", "root", "part", 1],
      ["store", "root", "part", 1],
      ["sync", "store", "subsystem", 2],
    ]);
    expect(Object.values(s.links).filter((l) => l.hierarchy).map((l) => l.id)).toEqual([
      "root->ui",
      "root->store",
      "store->sync",
    ]);
    expect(node(10, "ui")?.files).toEqual(["src/ui/editor.tsx"]);
  });

  it("follows the focus and shows a thought until the agent does something", () => {
    expect(node(11, "ui")?.isFocused).toBe(true);
    expect(node(11, "root")?.isFocused).toBe(false);
    expect(node(12, "ui")?.isThinking).toBe(true);
    expect(at(12).thinking?.text).toBe("What does the editor screen do?");
    expect(at(13).thinking).toBeNull();
    expect(at(13).latestInsight).toMatchObject({ nodeId: "ui", text: "Notes are written in Markdown" });
  });

  it("counts moves between parts on one link in either direction", () => {
    const s = at(16);
    const link = s.links["ui->store"];
    expect(link).toMatchObject({ hierarchy: false, touchCount: 2 });
    expect(s.links["store->ui"]).toBeUndefined();
    expect(node(16, "ui")?.touchCount).toBe(2);
    expect(node(16, "store")?.touchCount).toBe(2);
  });

  it("remembers the parts the agent has been in", () => {
    expect(at(10).visited).toEqual(["root"]);
    expect(at(16).visited).toEqual(["root", "ui", "store"]);
  });

  it("keeps an insight once", () => {
    expect(node(17, "ui")?.insights).toEqual(["Notes are written in Markdown"]);
  });

  it("shows the progress of a part on its node", () => {
    expect(node(19, "store")?.progress).toBeCloseTo(1 / 3);
    expect(node(19, "ui")?.progress).toBeNull();
  });

  it("puts another version of the project next to the original", () => {
    const s = at(20);
    expect(s.nodes.fork).toMatchObject({ kind: "project", parent: "root", depth: 0 });
    expect(s.links["root->fork"]).toMatchObject({ hierarchy: true });
  });

  it("ends with the offers and their sources", () => {
    const s = at(22);
    expect(s.stage).toBe("summary");
    expect(s.offers.map((o) => o.source?.kind)).toEqual(["issues", "similar", "analysis"]);
  });

  it("counts the estimate down from when it was given", () => {
    expect(etaLeft(at(2), after(2))).toEqual({ scope: "analysis", left: 120 });
    expect(etaLeft(at(2), after(2) + 30_000)?.left).toBe(90);
    expect(etaLeft(at(2), after(2) + 999_000)?.left).toBe(0);
  });
});

describe("canvas state: task", () => {
  it("shows the task, its parts and the plan step being done", () => {
    const s = at(31);
    expect(s.task).toMatchObject({ text: "Add a dark theme", nodes: ["ui"] });
    expect(node(31, "ui")?.isTaskNode).toBe(true);
    expect(s.plan).toHaveLength(3);
    expect(s.step).toBe(1);
    expect(s.stage).toBe("change");
  });

  it("marks changed parts, a part where a check broke, and clears it when it is changed again", () => {
    expect(at(32).changed).toEqual(["ui", "store"]);
    expect(node(34, "ui")).toMatchObject({ isChanged: true, isFailed: true });
    expect(node(35, "ui")?.isFailed).toBe(false);
    expect(at(36).checks.map((c) => c.ok)).toEqual([false, true]);
  });

  it("records the messages the agent took into account", () => {
    expect(at(37).notesTaken).toEqual([
      { noteId: "n1", related: ["ui"], reply: "Kept the toggle in the settings", at: after(37) },
    ]);
  });

  it("ends with the result, no estimate, and the task in the history", () => {
    const s = at(39);
    expect(s.stage).toBe("done");
    expect(s.result).toMatchObject({ text: "The dark theme is added", detail: "2 parts changed" });
    expect(s.result?.artifacts.map((a) => a.kind)).toEqual(["build", "changes"]);
    expect(etaLeft(s, after(39))).toBeNull();
    expect(s.history).toEqual([
      {
        at: after(39),
        task: "Add a dark theme",
        result: "The dark theme is added",
        changed: ["Editor screen", "Note storage"],
        artifacts: s.result?.artifacts,
      },
    ]);
  });

  it("starts a new task clean and keeps the map and the history", () => {
    const s = applyCanvasEvent(at(39), { type: "task", text: "Export to PDF", nodes: [] }, after(40));
    expect(s).toMatchObject({ plan: [], step: -1, checks: [], result: null, changed: [], failed: [] });
    expect(s.history).toHaveLength(1);
    expect(Object.keys(s.nodes)).toHaveLength(5);
  });

  it("knows the task is paused until it goes on or ends", () => {
    let s = applyCanvasEvent(at(31), { type: "paused" }, after(32));
    expect(s.paused).toBe(true);
    s = applyCanvasEvent(s, { type: "resumed" }, after(33));
    expect(s.paused).toBe(false);
    s = applyCanvasEvent(applyCanvasEvent(s, { type: "paused" }, after(34)), { type: "result", text: "Cancelled", detail: "" }, after(35));
    expect(s.paused).toBe(false);
  });

  it("does not change the state it was given", () => {
    const before = JSON.stringify(initialCanvasState);
    buildCanvasState(stream);
    expect(JSON.stringify(initialCanvasState)).toBe(before);
  });
});

describe("canvas state: work of an unknown amount", () => {
  const records = [
    { seq: 1, at: 1000, session: "b1", ev: { type: "project", id: "root", label: "notes-app", summary: "" } },
    { seq: 2, at: 2000, session: "b1", ev: { type: "stage", id: "check" } },
    { seq: 3, at: 2000, session: "b1", ev: { type: "eta", scope: "task", seconds: 40 } },
    { seq: 4, at: 2100, session: "b1", ev: { type: "progress", done: 0, total: 0, eta: 0, id: "root", spec: "go@1.23" } },
    { seq: 5, at: 9000, session: "b1", ev: { type: "check", ok: true, text: "The build passed", kind: "build", exit: 0 } },
  ] as const;
  const state = (n: number) => buildCanvasState(records.slice(0, n) as never);

  it("spins on the build's node until the next event", () => {
    expect(state(4).progress).toMatchObject({ unit: undefined, spec: "go@1.23", id: "root" });
    expect(canvasNodes(state(4)).find((n) => n.id === "root")?.progress).toBe(-1);
    expect(etaLeft(state(4), 2000)).toEqual({ scope: "task", left: 40 });
    expect(state(5).progress).toBeNull();
  });
});
