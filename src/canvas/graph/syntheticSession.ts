import type { CanvasEvent, CanvasRecord } from "../../client/protocol.generated.ts";

/** A small deterministic random generator (mulberry32), so a made-up session is the same every time. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = ["Editor", "Storage", "Sync", "Search", "Settings", "Themes", "Export", "Import", "Tags", "Login", "Sharing", "Backup", "Images", "Links", "Print", "History"];

/**
 * A made-up analysis of a project with `size` parts (the root included): parts are found branch by branch,
 * the agent looks at them and moves between them, as an analysis would report it. One event per `stepMs`.
 */
export function syntheticAnalysis(size: number, seed = 1, stepMs = 250): CanvasRecord[] {
  const rnd = seeded(seed);
  const events: CanvasEvent[] = [
    { type: "stage", id: "parts" },
    { type: "project", id: "root", label: "notes-app", summary: "A small app for taking notes" },
    { type: "focus", id: "root" },
  ];
  const ids = ["root"];
  // In a big project the agent reads only some of the parts.
  const look = Math.min(0.35, 9 / size);
  const depth = new Map([["root", 0]]);
  for (let i = 1; i < size; i++) {
    // Mostly shallow branches, some deep ones; big projects get wide second levels.
    const candidates = ids.filter((id) => (depth.get(id) ?? 0) < 4);
    const parent = candidates[Math.floor(Math.pow(rnd(), 1.6) * candidates.length)] ?? "root";
    const id = `p${i}`;
    const d = (depth.get(parent) ?? 0) + 1;
    const label = `${WORDS[i % WORDS.length]} ${Math.floor(i / WORDS.length) || ""}`.trim();
    events.push(
      d >= 3
        ? { type: "subsystem", id, parent, label, summary: `Part of ${parent}` }
        : { type: "found", id, parent, label, summary: `What ${label.toLowerCase()} does`, files: [`src/${id}.ts`] },
    );
    ids.push(id);
    depth.set(id, d);
    if (rnd() < look) events.push({ type: "focus", id });
    if (rnd() < look * 0.7) {
      const other = ids[Math.floor(rnd() * ids.length)] ?? "root";
      if (other !== id) events.push({ type: "touch", from: id, to: other });
    }
    if (rnd() < 0.1) events.push({ type: "insight", id, text: `${label} keeps its data in one place` });
  }
  events.push({ type: "stage", id: "summary" });
  return events.map((ev, i) => ({ seq: i + 1, at: (i + 1) * stepMs, session: "synthetic", ev }));
}
