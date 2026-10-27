// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "../../i18n/i18nStore.ts";
import { buildCanvasState } from "../canvasState.ts";
import { after, stream } from "../testSessions.ts";
import { StageRail } from "./StageRail.tsx";
import { StopBanner } from "./StopBanner.tsx";

const at = (n: number) => buildCanvasState(stream, after(n));

describe("stage rail", () => {
  beforeEach(() => useI18nStore.getState().setLocale("en"));
  afterEach(() => vi.useRealTimers());

  it("shows nothing before the first stage", () => {
    const { container } = render(<StageRail state={buildCanvasState([])} now={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the analysis stages with the current one and the download progress", () => {
    render(<StageRail state={at(3)} now={after(3)} />);
    expect(screen.getByText("Download").closest("[aria-current]")?.getAttribute("aria-current")).toBe("step");
    expect(screen.getByText("Parts")).toBeTruthy();
    expect(screen.getByTestId("stage-now").textContent).toContain("2 of 4 MB");
    expect(screen.getByTestId("stage-eta").textContent).toBe("Analysis: ≈ 2 min left");
  });

  it("shows what the agent thinks, then the stage line goes after a quiet while", () => {
    vi.useFakeTimers();
    const { rerender } = render(<StageRail state={at(12)} now={after(12)} />);
    expect(screen.getByTestId("stage-now").textContent).toContain("ThinkingWhat does the editor screen do?");
    rerender(<StageRail state={at(14)} now={after(14)} />);
    expect(screen.getByTestId("stage-now").textContent).toContain("Working out how the parts are linked");
    act(() => vi.advanceTimersByTime(6100));
    expect(screen.queryByTestId("stage-now")).toBeNull();
  });

  it("shows the task stages after the analysis, and Stop while the agent works", () => {
    const onStop = vi.fn();
    const { rerender } = render(<StageRail state={at(31)} now={after(31)} onStop={onStop} />);
    expect(screen.getByText("Analysis")).toBeTruthy();
    expect(screen.getByText("Changes").closest("[aria-current]")).toBeTruthy();
    expect(screen.getByTestId("stage-eta").textContent).toBe("Task: ≈ 5 min left");
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalledTimes(1);
    rerender(<StageRail state={at(39)} now={after(39)} onStop={onStop} />);
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
    expect(screen.queryByTestId("stage-eta")).toBeNull();
  });

  it("speaks Russian", () => {
    useI18nStore.getState().setLocale("ru");
    render(<StageRail state={at(31)} now={after(31) + 250_000} />);
    expect(screen.getByText("Изменения")).toBeTruthy();
    // The estimate of 300 s was given at event 25.
    expect(screen.getByTestId("stage-eta").textContent).toBe("Задача: ещё 44 с");
  });
});

describe("stop banner", () => {
  it("continues or cancels", () => {
    useI18nStore.getState().setLocale("en");
    const onResume = vi.fn();
    const onCancel = vi.fn();
    render(<StopBanner onResume={onResume} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel the task" }));
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
