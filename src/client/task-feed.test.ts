import { describe, expect, it } from "vitest";
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

  it("skips what the chat does not show", () => {
    expect(line({ type: "stderr", text: "noise" })).toBeNull();
    expect(line({ type: "evt", provider: "claude", ev: { kind: "init", cli: "claude" } })).toBeNull();
  });
});
