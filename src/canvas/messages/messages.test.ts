import { describe, expect, it } from "vitest";
import { buildCanvasState } from "../canvasState.ts";
import { after, stream } from "../testSessions.ts";
import { conversation, markNotDelivered, overLimit, promptWithText, textAttachment, waitingCount, type PersonMessage } from "./messages.ts";

const note = (id: string, at: number, takenBefore = 0): PersonMessage => ({
  id,
  text: `note ${id}`,
  attachments: [],
  at,
  kind: "note",
  takenBefore,
});

describe("conversation with the agent", () => {
  it("shows a note as waiting until the agent takes it, then its answer with the parts", () => {
    const sent = [note("a", after(30))];
    const before = conversation(sent, buildCanvasState(stream, after(36)).notesTaken);
    expect(before).toMatchObject([{ who: "person", status: "waiting" }]);
    expect(waitingCount(before)).toBe(1);

    const later = conversation(sent, buildCanvasState(stream, after(37)).notesTaken);
    expect(later).toMatchObject([
      { who: "person", status: "taken" },
      { who: "agent", text: "Kept the toggle in the settings", related: ["ui"] },
    ]);
    expect(waitingCount(later)).toBe(0);
  });

  it("gives the agent's answers to notes in the order they were sent", () => {
    const taken = [
      { noteId: "x", related: [], reply: "first", at: 10 },
      { noteId: "y", related: [], reply: "second", at: 20 },
    ];
    const items = conversation([note("a", 1), note("b", 2), note("c", 3)], taken);
    expect(items.map((i) => (i.who === "person" ? `${i.id}:${i.status}` : i.text))).toEqual([
      "a:taken",
      "b:taken",
      "c:waiting",
      "first",
      "second",
    ]);
  });

  it("does not give a note an answer the agent had already given before it was sent", () => {
    const taken = [{ noteId: "old", related: [], reply: "from before", at: 1 }];
    const items = conversation([note("a", 5, 1)], taken);
    expect(items).toMatchObject([{ who: "agent", text: "from before" }, { who: "person", status: "waiting" }]);
  });

  it("marks the newest note as not delivered; a task message stays a task", () => {
    const task: PersonMessage = { ...note("t", 1), kind: "task" };
    const marked = markNotDelivered([task, note("a", 2), note("b", 3)]);
    expect(conversation(marked, []).map((i) => i.who === "person" && i.status)).toEqual(["task", "waiting", "failed"]);
    expect(markNotDelivered([task])).toEqual([task]);
  });
});

describe("attachments", () => {
  it("keeps long text as a UTF-8 attachment and puts it into a new task's prompt", () => {
    const a = textAttachment("Тёмная тема", "pasted.txt");
    expect(a.mime).toBe("text/plain");
    expect(promptWithText("Do this", [a, { name: "shot.png", mime: "image/png", data: "AAAA" }])).toBe(
      "Do this\n\n--- pasted.txt ---\nТёмная тема",
    );
  });

  it("limits the size of pictures and text", () => {
    expect(overLimit({ size: 4 * 1024 * 1024, type: "image/png" })).toBeNull();
    expect(overLimit({ size: 6 * 1024 * 1024, type: "image/png" })).toBe(5 * 1024 * 1024);
    expect(overLimit({ size: 2 * 1024 * 1024, type: "text/plain" })).toBe(1024 * 1024);
  });
});
