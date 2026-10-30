import { describe, expect, it } from "vitest";
import { useI18nStore } from "../../i18n/i18nStore.ts";
import { stream } from "../../canvas/testSessions.ts";
import { agentSteps } from "./JournalPanel.tsx";

describe("journal: what the agent does", () => {
  it("tells the stages, thoughts, findings, changes and checks of the session stream in order", () => {
    useI18nStore.getState().setLocale("en");
    const { t } = useI18nStore.getState();
    const labels: Record<string, string> = { ui: "Editor screen", store: "Note storage" };
    const steps = agentSteps(stream, t, (id) => labels[id] ?? id);
    const kinds = new Set(steps.map((s) => s.kind));
    for (const kind of ["stage", "think", "insight", "change", "check"]) expect(kinds.has(kind as never)).toBe(true);
    expect(steps.some((s) => s.text === "Changed: Editor screen")).toBe(true);
    expect(steps.map((s) => s.at)).toEqual([...steps.map((s) => s.at)].sort((a, b) => a - b));
  });
});
