import { describe, expect, it } from "vitest";
import { buildCanvasState } from "../../canvas/canvasState.ts";
import { after, stream } from "../../canvas/testSessions.ts";
import { fileTree, knownFiles, partOfFile } from "./files.ts";

describe("files of the project", () => {
  it("lists what the agent changed, the latest first, with the part", () => {
    const state = buildCanvasState(stream, after(32));
    expect(state.changedFiles.map((f) => [f.path, f.node])).toEqual([
      ["src/store/settings.ts", "store"],
      ["src/ui/theme.ts", "ui"],
    ]);
    // Changed again: it moves up, once.
    const later = buildCanvasState(stream, after(35));
    expect(later.changedFiles.map((f) => f.path)).toEqual(["src/ui/theme.ts", "src/store/settings.ts"]);
  });

  it("builds a tree of known files, folders first", () => {
    const state = buildCanvasState(stream);
    expect(knownFiles(state).sort()).toEqual(["src/store/db.ts", "src/store/settings.ts", "src/ui/editor.tsx", "src/ui/theme.ts"]);
    const tree = fileTree(["src/b.ts", "README.md", "src/ui/a.tsx", "src/a.ts"]);
    expect(tree.map((e) => e.name)).toEqual(["src", "README.md"]);
    expect(tree[0]!.children!.map((e) => e.name)).toEqual(["ui", "a.ts", "b.ts"]);
    expect(tree[0]!.children![0]!.children![0]!.path).toBe("src/ui/a.tsx");
  });

  it("finds the part of a file", () => {
    const state = buildCanvasState(stream);
    expect(partOfFile(state, "src/store/db.ts")).toBe("store");
    expect(partOfFile(state, "src/ui/theme.ts")).toBe("ui");
    expect(partOfFile(state, "nowhere.ts")).toBeNull();
  });
});
