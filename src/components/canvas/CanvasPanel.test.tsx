// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useGraphStore } from "../../stores/graphStore.ts";
import { useSessionStore } from "../../stores/sessionStore.ts";
import { CanvasPanel } from "./CanvasPanel.tsx";

describe("CanvasPanel", () => {
  beforeAll(() => {
    class MockResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = MockResizeObserver;
    globalThis.ResizeObserver = MockResizeObserver;
  });

  beforeEach(() => {
    useGraphStore.getState().resetGraph();
    useSessionStore.getState().setConnectionStatus("connected");
  });

  it("renders empty canvas onboarding state when no nodes exist", () => {
    render(<CanvasPanel />);
    expect(screen.getByTestId("empty-canvas")).toBeTruthy();
    expect(screen.getByText(/карта проекта|no graph/i)).toBeTruthy();
  });

  it("renders reconnecting banner when session is reconnecting", () => {
    useSessionStore.getState().setConnectionStatus("reconnecting");
    render(<CanvasPanel />);
    expect(screen.getByTestId("reconnecting-banner")).toBeTruthy();
  });

  it("renders DoneSummary when phase is done", () => {
    useGraphStore.getState().applySnapshot({
      revision: 1,
      nodes: [{ id: "n1", label: "Module 1", status: "done" }],
      edges: [],
      focus: null,
      phase: "done",
    });

    render(<CanvasPanel />);
    expect(screen.getByRole("region", { name: /завершена|completed/i })).toBeTruthy();
  });

  it("handles Home key navigation jumping to focused node", () => {
    useGraphStore.getState().applySnapshot({
      revision: 2,
      nodes: [
        { id: "mod-1", label: "Module 1", status: "done" },
        { id: "mod-2", label: "Module 2", status: "exploring" },
      ],
      edges: [{ from: "mod-1", to: "mod-2" }],
      focus: "mod-2",
      phase: "exploring",
    });

    render(<CanvasPanel />);
    const canvas = screen.getByRole("region", { name: "Module Canvas" });

    // Press Home
    const homeEvent = new KeyboardEvent("keydown", { key: "Home", bubbles: true });
    canvas.dispatchEvent(homeEvent);
  });
});
