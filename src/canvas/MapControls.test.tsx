// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useI18nStore } from "../i18n/i18nStore.ts";
import { useAiPanelStore } from "../stores/aiPanelStore.ts";
import { useGraphStore, type MapNotice } from "../stores/graphStore.ts";
import { MapControls } from "./MapControls.tsx";

const show = (mapNotice: MapNotice) => {
  useGraphStore.setState({ isDescribing: false, mapNotice });
  render(<MapControls />);
  return screen.getByTestId("map-notice");
};

describe("why the map shows folders", () => {
  beforeEach(() => {
    useI18nStore.getState().setLocale("en");
    useAiPanelStore.setState({ open: false });
  });
  afterEach(cleanup);

  it("asks to connect an AI when none is, and opens the panel", () => {
    const notice = show({ kind: "failed", reason: "Connect an AI to split the project into parts", code: "no_models" });
    expect(notice.textContent).toContain("Connect an AI to split the project into parts — showing folders.");
    fireEvent.click(screen.getByText("Connect AI"));
    expect(useAiPanelStore.getState().open).toBe(true);
  });

  it("says a project without files has no parts, with nothing to retry", () => {
    const notice = show({ kind: "failed", reason: "no files", code: "project_empty" });
    expect(notice.textContent).toBe("The project has no files yet, so there are no parts to show.");
  });

  it("says the split failed with the agent's reason on hover, from a new and an old agent alike", () => {
    for (const code of ["map_failed", undefined]) {
      const notice = show({ kind: "failed", reason: "codex: gave no answer", ...(code ? { code } : {}) });
      expect(notice.textContent).toContain("Could not split the project into parts — showing folders.");
      expect(notice.getAttribute("title")).toBe("codex: gave no answer");
      expect(screen.getByText("Try again")).toBeTruthy();
      cleanup();
    }
  });

  it("speaks the person's language", () => {
    useI18nStore.getState().setLocale("ru");
    const notice = show({ kind: "failed", reason: "x", code: "no_models" });
    expect(notice.textContent).toContain("Подключите ИИ, чтобы разбить проект на части");
    expect(screen.getByText("Подключить ИИ")).toBeTruthy();
  });
});
