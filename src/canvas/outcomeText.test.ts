import { describe, expect, it } from "vitest";
import { translate } from "../i18n/i18nStore.ts";
import type { Locale, TranslationKey, TranslationParams } from "../i18n/types.ts";
import { applyCanvasEvent, initialCanvasState } from "./canvasState.ts";
import { checkText, resultDetail, resultText } from "./outcomeText.ts";

const tr = (locale: Locale) => (key: TranslationKey, params?: TranslationParams) => translate(locale, key, params);
const noLabel = () => undefined;

describe("task outcomes in the person's language", () => {
  it("words a finished, failed or cancelled task by its kind, not the agent's English", () => {
    expect(resultText(tr("ru"), { text: "Done", kind: "done", exit: 0 })).toBe("Готово");
    expect(resultText(tr("ru"), { text: "Failed (code 2)", kind: "failed", exit: 2 })).toBe("Задача не удалась (код 2)");
    expect(resultText(tr("en"), { text: "Failed (code 2)", kind: "failed", exit: 2 })).toBe("The task failed (code 2)");
    expect(resultText(tr("ru"), { text: "Cancelled", kind: "cancelled" })).toBe("Отменено");
    expect(resultText(tr("ru"), { text: "Part rolled back", kind: "part_rolled_back" })).toBe("Часть откачена");
  });

  it("shows the agent's text for events of an older agent", () => {
    expect(resultText(tr("ru"), { text: "Done" })).toBe("Done");
    expect(checkText(tr("ru"), { ok: true, text: "The build passed" })).toBe("The build passed");
    expect(resultDetail(tr("ru"), { text: "Done", detail: "2 files changed", artifacts: [] }, noLabel)).toBe("2 files changed");
  });

  it("words build checks", () => {
    expect(checkText(tr("ru"), { ok: true, text: "The build passed", kind: "build", exit: 0 })).toBe("Сборка прошла");
    expect(checkText(tr("ru"), { ok: false, text: "The build failed (code 1)", kind: "build", exit: 1 })).toBe(
      "Сборка не удалась (код 1)",
    );
  });

  it("counts the changed files with the language's plural forms", () => {
    const changes = (n: number) => [
      { name: "changes", kind: "changes" as const, files: Array.from({ length: n }, (_, i) => ({ path: `src/note${i}.ts` })) },
    ];
    const detail = (locale: Locale, n: number) =>
      resultDetail(tr(locale), { text: "Done", detail: "git stat", artifacts: changes(n), kind: "done", exit: 0 }, noLabel);
    expect([1, 3, 5, 21].map((n) => detail("ru", n))).toEqual([
      "Изменён 1 файл",
      "Изменено 3 файла",
      "Изменено 5 файлов",
      "Изменён 21 файл",
    ]);
    expect([1, 3].map((n) => detail("en", n))).toEqual(["1 file changed", "3 files changed"]);
  });

  it("names the part that went back", () => {
    const r = { text: "Part rolled back", detail: "The part \"Search\" was returned…", artifacts: [], kind: "part_rolled_back" as const, id: "p1" };
    expect(resultDetail(tr("ru"), r, (id) => (id === "p1" ? "Поиск" : undefined))).toBe(
      "«Поиск» вернулась к виду до последней задачи, которая её меняла; остальные части не изменились.",
    );
    expect(resultDetail(tr("ru"), r, noLabel)).toBe(r.detail);
  });

  it("keeps the kind in the canvas state and the history", () => {
    let s = applyCanvasEvent(initialCanvasState, { type: "task", text: "Add tags", nodes: [] }, 1);
    s = applyCanvasEvent(s, { type: "check", ok: false, text: "The build failed (code 1)", kind: "build", exit: 1 }, 2);
    s = applyCanvasEvent(s, { type: "result", text: "Failed (code 1)", detail: "", kind: "failed", exit: 1 }, 3);
    expect(s.checks[0]).toMatchObject({ kind: "build", exit: 1 });
    expect(s.result).toMatchObject({ kind: "failed", exit: 1 });
    expect(s.history[0]?.outcome).toEqual({ text: "Failed (code 1)", kind: "failed", exit: 1 });
    expect(resultText(tr("ru"), s.history[0]!.outcome!)).toBe("Задача не удалась (код 1)");
  });
});
