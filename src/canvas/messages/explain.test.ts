import { describe, expect, it } from "vitest";
import type { CanvasEvent } from "../../client/protocol.generated.ts";
import { applyCanvasEvent, initialCanvasState, type CanvasState } from "../canvasState.ts";
import { conversation, explainReason, type PersonMessage } from "./messages.ts";

const play = (events: [CanvasEvent, number][]): CanvasState => events.reduce((s, [ev, at]) => applyCanvasEvent(s, ev, at), initialCanvasState);

describe("explanations in the conversation", () => {
  it("keeps each question with the answer that follows it", () => {
    const s = play([
      [{ type: "question", text: "Explain the part “Notes”", id: "p2" }, 10],
      [{ type: "think", id: "p2", text: "Looking into the part Notes" }, 11],
      [{ type: "explained", text: "It keeps your notes.", id: "p2" }, 20],
      [{ type: "question", text: "What is this project?" }, 30],
    ]);
    expect(s.explanations).toEqual([
      { question: "Explain the part “Notes”", id: "p2", at: 10, answer: { text: "It keeps your notes.", code: undefined, at: 20 } },
      { question: "What is this project?", id: undefined, at: 30 },
    ]);
    // Thinking ends with the answer, as with any other event.
    expect(s.thinking).toBeNull();
    // A question is not a task: nothing of the last task is reset.
    expect(s.task).toBeNull();
  });

  it("shows the question, its status and the answer, linked to the part", () => {
    const s = play([
      [{ type: "question", text: "Explain the part “Notes”", id: "p2" }, 10],
      [{ type: "explained", text: "It keeps your notes.", id: "p2" }, 20],
      [{ type: "question", text: "And the rest?" }, 30],
    ]);
    expect(conversation([], [], s.explanations)).toEqual([
      { who: "person", id: "q0-10", text: "Explain the part “Notes”", attachments: [], status: "explained", at: 10 },
      { who: "agent", id: "a0-10", text: "It keeps your notes.", related: ["p2"], at: 20 },
      { who: "person", id: "q1-30", text: "And the rest?", attachments: [], status: "explaining", at: 30 },
    ]);
  });

  it("says why there is no answer, by the agent's code", () => {
    const s = play([
      [{ type: "question", text: "What is it?" }, 10],
      [{ type: "explained", text: "", code: "no_models" }, 12],
    ]);
    const items = conversation([], [], s.explanations);
    expect(items[1]).toMatchObject({ who: "agent", text: "", reason: "messages.explainNoModels" });
    expect(explainReason("explain_failed")).toBe("messages.explainFailed");
    expect(explainReason("task_already_running")).toBe("messages.explainBusy");
    expect(explainReason("explain_already_running")).toBe("messages.explainBusy");
    expect(explainReason("project_forbidden")).toBe("messages.explainForbidden");
    expect(explainReason("not_supported")).toBe("messages.explainNotSupported");
    expect(explainReason(undefined)).toBe("messages.explainFailed");
  });

  it("puts a question the agent did not take in order with the rest", () => {
    const refused: PersonMessage = {
      id: "e1",
      text: "What is it?",
      attachments: [],
      at: 5,
      kind: "explain",
      takenBefore: 0,
      failed: true,
      reason: "messages.explainNotSupported",
    };
    const task: PersonMessage = { id: "m1", text: "Add tags", attachments: [], at: 1, kind: "task", takenBefore: 0 };
    expect(conversation([task, refused], []).map((i) => [i.who, i.who === "person" ? i.status : i.reason])).toEqual([
      ["person", "task"],
      ["person", "unanswered"],
      ["agent", "messages.explainNotSupported"],
    ]);
  });
});
