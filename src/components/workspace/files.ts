import type { CanvasState } from "../../canvas/canvasState.ts";

/** A folder or a file of the project tree. */
export interface TreeEntry {
  name: string;
  path: string;
  /** Present for folders, sorted: folders first, then by name. */
  children?: TreeEntry[];
}

/** Every file the canvas knows: those of its parts and those the agent changed, without repeats. */
export function knownFiles(state: CanvasState): string[] {
  const all = new Set<string>();
  for (const id of state.order) for (const f of state.nodes[id]?.files ?? []) all.add(f);
  for (const f of state.changedFiles) all.add(f.path);
  return [...all];
}

/** The tree of folders and files from paths like `src/ui/editor.tsx`. */
export function fileTree(paths: string[]): TreeEntry[] {
  const root: TreeEntry = { name: "", path: "", children: [] };
  for (const path of paths) {
    const parts = path.split("/").filter(Boolean);
    let dir = root;
    parts.forEach((name, i) => {
      const entryPath = parts.slice(0, i + 1).join("/");
      const isFile = i === parts.length - 1;
      let entry = dir.children!.find((c) => c.name === name && !c.children === isFile);
      if (!entry) {
        entry = isFile ? { name, path: entryPath } : { name, path: entryPath, children: [] };
        dir.children!.push(entry);
      }
      if (!isFile) dir = entry;
    });
  }
  const sort = (entries: TreeEntry[]): TreeEntry[] =>
    entries
      .map((e) => (e.children ? { ...e, children: sort(e.children) } : e))
      .sort((a, b) => (a.children ? 0 : 1) - (b.children ? 0 : 1) || a.name.localeCompare(b.name));
  return sort(root.children!);
}

/** The part a file belongs to: where the agent changed it, else the part that lists it. */
export function partOfFile(state: CanvasState, path: string): string | null {
  const changed = state.changedFiles.find((f) => f.path === path && f.node);
  if (changed && state.nodes[changed.node]) return changed.node;
  return state.order.find((id) => state.nodes[id]?.files.includes(path)) ?? null;
}
