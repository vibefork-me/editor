// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "../../i18n/i18nStore.ts";
import { buildCanvasState } from "../canvasState.ts";
import { after, stream } from "../testSessions.ts";
import { ArtifactWindow, HistoryPanel, ResultScreen, TaskPanel } from "./TaskViews.tsx";

const at = (n: number) => buildCanvasState(stream, after(n));

describe("task views", () => {
  beforeEach(() => useI18nStore.getState().setLocale("en"));

  it("task panel: the plan with what is done and the checks, only while the task runs", () => {
    const { rerender, container } = render(<TaskPanel state={at(20)} />);
    expect(container.firstChild).toBeNull();
    rerender(<TaskPanel state={at(34)} />);
    expect(screen.getByText("Add a dark theme")).toBeTruthy();
    expect(screen.getByText("Add theme colors")).toBeTruthy();
    expect(screen.getByText("The build failed in the editor screen")).toBeTruthy();
    rerender(<TaskPanel state={at(37)} />);
    expect(screen.getByText("↳ as you asked: Kept the toggle in the settings")).toBeTruthy();
    rerender(<TaskPanel state={at(39)} />);
    expect(screen.queryByTestId("task-panel")).toBeNull();
  });

  it("result screen: what came out and what it produced", () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    render(<ResultScreen state={at(39)} onOpen={onOpen} onClose={onClose} />);
    expect(screen.getByText("The dark theme is added")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Changes/ }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ kind: "changes" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("artifact window: changed files with their part and lines", () => {
    const changes = at(39).result!.artifacts.find((a) => a.kind === "changes")!;
    render(<ArtifactWindow artifact={changes} label={(id) => (id === "ui" ? "Editor screen" : id)} onClose={() => {}} />);
    expect(screen.getByText("src/ui/theme.ts")).toBeTruthy();
    expect(screen.getByText("Editor screen")).toBeTruthy();
    expect(screen.getByText("+dark")).toBeTruthy();
  });

  it("history: the finished task first, with what it changed", () => {
    const onOpen = vi.fn();
    render(<HistoryPanel state={at(39)} onOpen={onOpen} onClose={() => {}} />);
    expect(screen.getByText("Changed: Editor screen, Note storage")).toBeTruthy();
    expect(screen.getByText("now")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ready file" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ kind: "build" }));
  });

  it("history: versions of the project to return to, the current one without a button", () => {
    const onRestore = vi.fn();
    const items = [
      { commit: "ccc3333", at: "2026-01-04T10:00:00Z", title: "", rollback: true, current: true },
      { commit: "aaa1111", at: "2026-01-02T10:00:00Z", title: "Add tags to notes", rollback: false, current: false },
    ];
    const { rerender } = render(<HistoryPanel state={at(5)} versions={{ items, restoring: null, onRestore }} onOpen={() => {}} onClose={() => {}} />);
    expect(screen.queryByText("No changes yet")).toBeNull();
    expect(screen.getByText("A part put back as it was")).toBeTruthy();
    expect(screen.getByText("now")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restore this version" }));
    expect(onRestore).toHaveBeenCalledWith("aaa1111");
    rerender(
      <HistoryPanel
        state={at(5)}
        versions={{ items, restoring: { commit: "aaa1111", status: { state: "failed", reason: "card.rollbackBusy" } }, onRestore }}
        onOpen={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("status").textContent).toBe("A task is running; wait until it ends");
  });
});
