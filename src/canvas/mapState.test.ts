import { describe, expect, it } from "vitest";
import { buildCanvasState } from "./canvasState.ts";
import { mapCanvasState, ROOT, withMap } from "./mapState.ts";
import { stream } from "./testSessions.ts";

const parts = [
  { id: "p1", label: "Editor screen", files: 3, changed: 0, status: "unchanged" },
  { id: "p2", label: "Note storage", files: 2, changed: 1, status: "changed" },
];

describe("the map on the canvas", () => {
  it("puts the parts of the model's map under the project root, with their ids", () => {
    const s = mapCanvasState(parts, [{ from: "p1", to: "p2" }], false, "notes-app");
    expect(s.order).toEqual([ROOT, "p1", "p2"]);
    expect(s.nodes.p1?.parent).toBe(ROOT);
    expect(s.nodes[ROOT]?.kind).toBe("project");
    expect(s.links["p1->p2"]?.hierarchy).toBe(false);
    expect(s.changed).toEqual(["p2"]);
  });

  it("keeps the nesting of folders", () => {
    const folders = [
      { id: "src/ui", label: "ui", files: 2, changed: 0, status: "unchanged" },
      { id: "src", label: "src", files: 5, changed: 0, status: "unchanged" },
      { id: "docs", label: "docs", files: 1, changed: 0, status: "unchanged" },
    ];
    const s = mapCanvasState(folders, [{ from: "src", to: "src/ui" }], true, "notes-app");
    expect(s.nodes["src/ui"]?.parent).toBe("src");
    expect(s.nodes["src/ui"]?.depth).toBe(2);
    // A part comes after the part it is in.
    expect(s.order.indexOf("src")).toBeLessThan(s.order.indexOf("src/ui"));
    expect(s.links["src->src/ui"]?.hierarchy).toBe(true);
  });

  it("puts the smaller pieces of a model's part inside it, as the stream does", () => {
    const s = mapCanvasState(
      [
        { id: "p1.1", label: "Search", files: 15, changed: 0, status: "unchanged", parent: "p1" },
        { id: "p1", label: "Notes", files: 50, changed: 1, status: "changed" },
        { id: "p2", label: "Saving", files: 2, changed: 0, status: "unchanged" },
        { id: "p2.1", label: "Lost", files: 1, changed: 0, status: "unchanged", parent: "p9" },
      ],
      [{ from: "p1", to: "p2" }],
      false,
      "notes-app",
    );
    expect(s.nodes["p1.1"]?.parent).toBe("p1");
    expect(s.nodes["p1.1"]?.kind).toBe("subsystem");
    expect(s.nodes["p1.1"]?.depth).toBe(2);
    expect(s.nodes.p1?.kind).toBe("part");
    expect(s.order.indexOf("p1")).toBeLessThan(s.order.indexOf("p1.1"));
    expect(s.links["p1->p1.1"]?.hierarchy).toBe(true);
    // A piece of a part the map does not have stays under the root, as a part.
    expect(s.nodes["p2.1"]?.parent).toBe(ROOT);
    expect(s.nodes["p2.1"]?.kind).toBe("part");
    // The same piece from the stream and from the map is one node, in the same place.
    const live = buildCanvasState([
      { seq: 1, at: 1, session: "s", ev: { type: "project", id: ROOT, label: "notes-app", summary: "" } },
      { seq: 2, at: 2, session: "s", ev: { type: "found", id: "p1", parent: ROOT, label: "Notes", summary: "", files: [] } },
    ]);
    const merged = withMap(live, s);
    expect(merged.nodes["p1.1"]?.parent).toBe("p1");
    expect(merged.nodes["p1.1"]?.depth).toBe(2);
  });

  it("is empty without parts", () => {
    expect(mapCanvasState([], [], false, "x").order).toEqual([]);
  });

  it("lays the stream over the map: the stream wins, parts it has not reported stay", () => {
    const map = mapCanvasState(
      [
        { id: "ui", label: "UI (map)", files: 1, changed: 0, status: "unchanged" },
        { id: "extra", label: "Extra", files: 1, changed: 0, status: "unchanged" },
      ],
      [],
      false,
      "notes-app",
    );
    const live = buildCanvasState(stream);
    const merged = withMap(live, map);
    expect(merged.nodes.ui?.label).toBe("Editor screen");
    expect(merged.nodes.extra?.parent).toBe("root");
    expect(merged.links["root->extra"]?.hierarchy).toBe(true);
    expect(merged.order.slice(0, live.order.length)).toEqual(live.order);
    // Without a stream: the map itself.
    expect(withMap(buildCanvasState([]), map).order).toEqual(map.order);
  });
});
