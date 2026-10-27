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
