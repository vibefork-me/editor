import type { CanvasEvent, CanvasRecord } from "../client/protocol.generated.ts";

// Two made-up sessions of a small notes app: its analysis, then a task on it.
// Between them they use every kind of canvas event.

export const analysis: CanvasEvent[] = [
  /* 1 */ { type: "stage", id: "download" },
  /* 2 */ { type: "eta", scope: "analysis", seconds: 120 },
  /* 3 */ { type: "progress", done: 2_097_152, total: 4_194_304, unit: "bytes", eta: 5, text: "Downloading" },
  /* 4 */ { type: "progress", done: 4_194_304, total: 4_194_304, unit: "bytes", eta: 0, text: "Downloading" },
  /* 5 */ { type: "stage", id: "parts" },
  /* 6 */ { type: "project", id: "root", label: "notes-app", summary: "A small app for taking notes" },
  /* 7 */ { type: "focus", id: "root" },
  /* 8 */ { type: "found", id: "ui", parent: "root", label: "Editor screen", summary: "Where notes are written", files: ["src/ui/editor.tsx"] },
  /* 9 */ { type: "found", id: "store", parent: "root", label: "Note storage", summary: "Keeps notes on the device", files: ["src/store/db.ts"] },
  /* 10 */ { type: "subsystem", id: "sync", parent: "store", label: "Sync", summary: "Sends notes to the server" },
  /* 11 */ { type: "focus", id: "ui" },
  /* 12 */ { type: "think", id: "ui", text: "What does the editor screen do?" },
  /* 13 */ { type: "insight", id: "ui", text: "Notes are written in Markdown" },
  /* 14 */ { type: "stage", id: "links" },
  /* 15 */ { type: "touch", from: "ui", to: "store" },
  /* 16 */ { type: "touch", from: "store", to: "ui" },
  /* 17 */ { type: "insight", id: "ui", text: "Notes are written in Markdown" },
  /* 18 */ { type: "stage", id: "tools" },
  /* 19 */ { type: "progress", done: 1, total: 3, unit: "steps", eta: 20, text: "Installing Node.js", id: "store" },
  /* 20 */ { type: "project", id: "fork", label: "notes-app (fork)", summary: "Another version with tags", versionOf: "root" },
  /* 21 */ { type: "stage", id: "summary" },
  /* 22 */ {
    type: "offers",
    items: [
      { title: "Dark theme", text: "Add a dark look", source: { kind: "issues", text: "Asked for in 4 issues" } },
      { title: "Export to PDF", text: "Save a note as a PDF", source: { kind: "similar", text: "Common in similar apps" } },
      { title: "Faster search", text: "Index the notes", source: { kind: "analysis", text: "Search reads every note" } },
    ],
  },
];

export const task: CanvasEvent[] = [
  /* 23 */ { type: "task", text: "Add a dark theme", nodes: ["ui"] },
  /* 24 */ { type: "stage", id: "understand" },
  /* 25 */ { type: "eta", scope: "task", seconds: 300 },
  /* 26 */ { type: "stage", id: "plan" },
  /* 27 */ { type: "plan", steps: ["Add theme colors", "Switch it in the settings", "Check the build"] },
  /* 28 */ { type: "stage", id: "change" },
  /* 29 */ { type: "step", index: 0 },
  /* 30 */ { type: "change", id: "ui", files: ["src/ui/theme.ts"] },
  /* 31 */ { type: "step", index: 1 },
  /* 32 */ { type: "change", id: "store", files: ["src/store/settings.ts"] },
  /* 33 */ { type: "stage", id: "check" },
  /* 34 */ { type: "check", ok: false, text: "The build failed in the editor screen", id: "ui" },
  /* 35 */ { type: "change", id: "ui", files: ["src/ui/theme.ts"] },
  /* 36 */ { type: "check", ok: true, text: "The build passed" },
  /* 37 */ { type: "note.taken", noteId: "n1", related: ["ui"], reply: "Kept the toggle in the settings" },
  /* 38 */ { type: "stage", id: "done" },
  /* 39 */ {
    type: "result",
    text: "The dark theme is added",
    detail: "2 parts changed",
    artifacts: [
      { name: "notes-app.zip", kind: "build", size: "2 MB" },
      { name: "Changes", kind: "changes", files: [{ path: "src/ui/theme.ts", node: "ui", diff: ["-light", "+dark"] }] },
    ],
  },
];

/** Events as a numbered stream: event `n` (from 1) has `seq` n and happens at `n` seconds. */
export function numbered(events: CanvasEvent[], first = 1): CanvasRecord[] {
  return events.map((ev, i) => ({ seq: first + i, at: (first + i) * 1000, session: first === 1 ? "analysis" : "task", ev }));
}

/** The whole stream: the analysis, then the task. */
export const stream: CanvasRecord[] = [...numbered(analysis), ...numbered(task, analysis.length + 1)];

/** Time (Unix ms) right after event `n` of `stream`. */
export const after = (n: number) => n * 1000;
