// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { NodeCard } from "./NodeCard.tsx";

const baseProps = {
  selected: false,
  zIndex: 1,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  draggable: false,
  selectable: false,
  deletable: false,
};

describe("NodeCard", () => {
  it("renders node label and exploring status", () => {
    render(
      <ReactFlowProvider>
        <NodeCard
          {...baseProps}
          id="test-node"
          type="moduleNode"
          data={{
            id: "test-node",
            label: "Auth Service",
            status: "exploring",
            isFocused: false,
            isFocusPulseDisabled: false,
            tabIndex: 0,
          }}
        />
      </ReactFlowProvider>
    );

    expect(screen.getByText("Auth Service")).toBeTruthy();
    expect(screen.queryByTestId("problem-flag")).toBeNull();
    expect(screen.queryByTestId("focus-badge")).toBeNull();
  });

  it("renders problem flag when status is problem", () => {
    render(
      <ReactFlowProvider>
        <NodeCard
          {...baseProps}
          id="prob-node"
          type="moduleNode"
          data={{
            id: "prob-node",
            label: "Database Core",
            status: "problem",
            isFocused: false,
            isFocusPulseDisabled: false,
            tabIndex: -1,
          }}
        />
      </ReactFlowProvider>
    );

    expect(screen.getByTestId("problem-flag")).toBeTruthy();
  });

  it("renders agent focus badge when isFocused is true", () => {
    render(
      <ReactFlowProvider>
        <NodeCard
          {...baseProps}
          id="focus-node"
          type="moduleNode"
          data={{
            id: "focus-node",
            label: "Engine Rust",
            status: "changing",
            isFocused: true,
            isFocusPulseDisabled: false,
            tabIndex: 0,
          }}
        />
      </ReactFlowProvider>
    );

    expect(screen.getByTestId("focus-badge")).toBeTruthy();
    expect(screen.getByText(/сейчас здесь|now here/i)).toBeTruthy();
  });

  it("renders changed and unchanged status labels and summary", () => {
    const { rerender } = render(
      <ReactFlowProvider>
        <NodeCard
          {...baseProps}
          id="node-1"
          type="moduleNode"
          data={{
            id: "node-1",
            label: "Parser",
            status: "changed",
            summary: "Parses model map",
            isFocused: false,
            isFocusPulseDisabled: false,
            tabIndex: 0,
          }}
        />
      </ReactFlowProvider>
    );

    expect(screen.getByText("Parser")).toBeTruthy();
    expect(screen.getByText("Parses model map")).toBeTruthy();

    rerender(
      <ReactFlowProvider>
        <NodeCard
          {...baseProps}
          id="node-1"
          type="moduleNode"
          data={{
            id: "node-1",
            label: "Parser",
            status: "unchanged",
            isFocused: false,
            isFocusPulseDisabled: false,
            tabIndex: 0,
          }}
        />
      </ReactFlowProvider>
    );

    expect(screen.getByText(/без изменений|unchanged/i)).toBeTruthy();
  });
});
