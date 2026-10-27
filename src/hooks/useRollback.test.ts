import { describe, expect, it } from "vitest";
import { applyCanvasEvent, buildCanvasState } from "../canvas/canvasState.ts";
import { after, stream } from "../canvas/testSessions.ts";
import { projectVersions, rollbackReason } from "./useRollback.ts";

describe("rollback", () => {
  it("says why a rollback did not happen, by the agent's code", () => {
    expect(rollbackReason("nothing_to_roll_back", "", "part")).toBe("card.undoNothing");
    expect(rollbackReason("rollback_not_confirmed", "", "version")).toBe("card.rollbackNotConfirmed");
    expect(rollbackReason("not_supported", "", "part")).toBe("card.rollbackNotSupported");
    expect(rollbackReason("not_found", "", "part")).toBe("card.undoNotFound");
    expect(rollbackReason("not_found", "", "version")).toBe("taskView.restoreNotFound");
    expect(rollbackReason(undefined, "a task is already running in this project", "part")).toBe("card.rollbackBusy");
    expect(rollbackReason(undefined, "disk full", "version")).toBe("card.rollbackFailed");
  });

  it("lists the journal's checkpoints newest first; the last entry is the current version", () => {
    const entry = (prompt: string, commit: string | null, provider = "claude") => ({ at: "2026-01-02T10:00:00Z", provider, model: "m", prompt, commit });
    const versions = projectVersions([entry("Add tags", "aaa1111"), entry("plan", null, "planner"), entry("roll back part store", "bbb2222", "rollback")]);
    expect(versions).toEqual([
      { commit: "bbb2222", at: "2026-01-02T10:00:00Z", title: "", rollback: true, current: true },
      { commit: "aaa1111", at: "2026-01-02T10:00:00Z", title: "Add tags", rollback: false, current: false },
    ]);
    // After a reset to a version, its own journal record has no checkpoint: no version is current.
    expect(projectVersions([entry("Add tags", "aaa1111"), entry("roll back to aaa1111", null, "rollback")])[0]?.current).toBe(false);
  });

  it("a part put back after a task shows its result but does not join the history of tasks", () => {
    const done = buildCanvasState(stream, after(39));
    const rolled = applyCanvasEvent(applyCanvasEvent(done, { type: "change", id: "store", files: [] }, 100), { type: "result", text: "Part rolled back", detail: "" }, 101);
    expect(rolled.result?.text).toBe("Part rolled back");
    expect(rolled.history).toHaveLength(done.history.length);
  });
});
