// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useGraphStore } from "../../stores/graphStore.ts";
import { PhaseRail } from "./PhaseRail.tsx";

describe("PhaseRail", () => {
  beforeEach(() => {
    useGraphStore.getState().resetGraph();
  });

  it("marks current phase with aria-current=step", () => {
    useGraphStore.setState({ phase: "edit" });
    render(<PhaseRail />);

    const current = screen.getByText("Правка").closest("[aria-current]");
    expect(current?.getAttribute("aria-current")).toBe("step");
  });

  it("uses list semantics for phases", () => {
    render(<PhaseRail />);
    expect(screen.getByRole("list")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });

  it("shows problem icon on current phase when graph has problem nodes", () => {
    useGraphStore.setState({
      phase: "build",
      nodes: new Map([
        ["n1", { id: "n1", label: "x", status: "problem" }],
      ]),
    });
    render(<PhaseRail />);
    const buildStep = screen.getByText("Сборка").closest("li");
    expect(buildStep?.querySelector("svg")).toBeTruthy();
  });
});
