import { describe, expect, it } from "vitest";
import { translate } from "../i18n/i18nStore.ts";
import { feedLine } from "./task-feed.ts";
import type { ServerMessage } from "./protocol.generated.ts";

describe("feedLine", () => {
  const line = (m: ServerMessage) => feedLine(m);
  it("shows the model's text, tool calls and errors", () => {
    expect(line({ type: "evt", provider: "claude", ev: { kind: "text", text: "Fixed the import" } })).toEqual({
      kind: "agent",
      text: "Fixed the import",
    });
    expect(line({ type: "evt", provider: "claude", ev: { kind: "tool", tool: "edit", detail: "src/a.ts" } })).toEqual({
      kind: "tool",
      text: "edit src/a.ts",
    });
    expect(line({ type: "error", error: "no provider" })).toEqual({ kind: "error", text: "no provider" });
  });

  it("shows the route, the plan and the result", () => {
    expect(
      line({
        type: "routing",
        choice: { cost: "subscription", label: "Claude Sonnet", model: "s", provider: "claude", tier: 2 },
        rating: { classifier: "c", complexity: "simple", decompose: false, reason: "small fix" },
      })?.text,
    ).toBe("Claude Sonnet — small fix");
    expect(
      line({ type: "plan", planner: "p", steps: [{ complexity: "s", label: "l", title: "Read" }, { complexity: "s", label: "l", title: "Fix" }] })
        ?.text,
    ).toBe("1. Read\n2. Fix");
    expect(line({ type: "done", code: 0, diff: "", status: "2 files changed" })).toEqual({
      kind: "status",
      text: "2 files changed",
    });
  });

  it("words a task error with a known code and keeps the agent's text", () => {
    const l = line({ type: "error", error: "model not available: codex gpt-x", code: "model_unavailable" });
    expect(l).toEqual({ kind: "error", text: "model not available: codex gpt-x", key: "agentErrors.modelUnavailable" });
    expect(translate("ru", l!.key!)).toBe("Выбранная модель сейчас недоступна");
    // An unknown code (a newer agent) shows the agent's text.
    expect(line({ type: "error", error: "something new", code: "brand_new" })).toEqual({ kind: "error", text: "something new" });
  });

  it("skips what the chat does not show", () => {
    expect(line({ type: "stderr", text: "noise" })).toBeNull();
    expect(line({ type: "evt", provider: "claude", ev: { kind: "init", cli: "claude" } })).toBeNull();
  });

  it("gives status lines a readable phrase and keeps the raw text", () => {
    const phrase = (m: ServerMessage) => {
      const l = line(m);
      if (!l?.key) throw new Error(`no phrase for ${m.type}`);
      return { text: l.text, ru: translate("ru", l.key, l.params), en: translate("en", l.key, l.params) };
    };
    expect(phrase({ type: "planning" })).toEqual({
      text: "planning",
      ru: "Агент составляет план",
      en: "The agent is planning",
    });
    expect(phrase({ type: "step-done", n: 1, of: 3, ok: true })).toEqual({
      text: "1/3 done",
      ru: "Шаг 1 из 3 готов",
      en: "Step 1 of 3 done",
    });
    expect(phrase({ type: "step-done", n: 2, of: 3, ok: false })).toEqual({
      text: "2/3 failed",
      ru: "Шаг 2 из 3 не удался",
      en: "Step 2 of 3 failed",
    });
    expect(phrase({ type: "done", code: 2, diff: "", status: "" })).toEqual({
      text: "exit 2",
      ru: "Задача завершилась с ошибкой (код 2)",
      en: "The task ended with an error (code 2)",
    });
    expect(phrase({ type: "done", code: 0, diff: "", status: "" })).toEqual({
      text: "exit 0",
      ru: "Агент выполнил задачу.",
      en: "The agent finished the task.",
    });
    expect(line({ type: "done", code: 0, diff: "", status: "2 files changed" })?.key).toBeUndefined();
  });
});
