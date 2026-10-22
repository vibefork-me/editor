// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("uses one roving tab stop and navigates with arrows and Home", () => {
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
    const firstNode = document.querySelector<HTMLButtonElement>('button[data-node-id="mod-1"]')!;
    const secondNode = document.querySelector<HTMLButtonElement>('button[data-node-id="mod-2"]')!;
    expect(firstNode.getAttribute("aria-labelledby")).toContain("canvas-node-label-mod-1");
    expect(firstNode.tabIndex).toBe(-1);
    expect(secondNode.tabIndex).toBe(0);

    fireEvent.keyDown(secondNode, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(firstNode);
    expect(firstNode.tabIndex).toBe(0);
    expect(secondNode.tabIndex).toBe(-1);

    fireEvent.keyDown(firstNode, { key: "Home" });
    expect(document.activeElement).toBe(secondNode);
  });

  it("does not intercept system keyboard shortcuts", () => {
    useGraphStore.getState().applySnapshot({
      revision: 3,
      nodes: [{ id: "mod-1", label: "Module 1", status: "done" }],
      edges: [],
      focus: "mod-1",
      phase: "exploring",
    });
    render(<CanvasPanel />);
    const node = document.querySelector<HTMLButtonElement>('button[data-node-id="mod-1"]')!;
    const event = new KeyboardEvent("keydown", { key: "l", ctrlKey: true, bubbles: true, cancelable: true });
    node.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("passes a node-prefixed prompt to the chat callback", () => {
    const onAskAbout = vi.fn();
    useGraphStore.getState().applySnapshot({
      revision: 4,
      nodes: [{ id: "mod-1", label: "Module 1", status: "exploring" }],
      edges: [],
      focus: null,
      phase: "exploring",
    });
    render(<CanvasPanel onAskAbout={onAskAbout} />);

    fireEvent.click(document.querySelector('button[data-node-id="mod-1"]')!);
    fireEvent.click(screen.getByRole("button", { name: /ask about|спросить/i }));
    expect(onAskAbout).toHaveBeenCalledWith("[Module 1] ");
  });

  it("stops focus pulse animations while reconnecting", () => {
    useGraphStore.getState().applySnapshot({
      revision: 5,
      nodes: [{ id: "mod-1", label: "Module 1", status: "exploring" }],
      edges: [],
      focus: "mod-1",
      phase: "exploring",
    });
    useSessionStore.getState().setConnectionStatus("reconnecting");
    render(<CanvasPanel />);
    expect(document.querySelector(".animate-focus-pulse")).toBeNull();
    expect(document.querySelector(".animate-phase-current")).toBeNull();
  });
});
