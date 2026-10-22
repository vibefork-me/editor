// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useProjectStore } from "../../stores/projectStore.ts";
import { useSessionStore } from "../../stores/sessionStore.ts";
import { StatusBar } from "./StatusBar.tsx";

vi.mock("../../hooks/useModelLabel.ts", () => ({
  useModelLabel: () => "Claude 3.5 Sonnet",
}));

function renderBar() {
  return render(
    <MemoryRouter>
      <StatusBar />
    </MemoryRouter>,
  );
}

describe("StatusBar", () => {
  beforeEach(() => {
    useSessionStore.setState({ connectionStatus: "disconnected" });
    useProjectStore.setState({
      projectMeta: { projectId: "demo-repo" },
      currentProjectId: "demo-repo",
    });
  });

  it("is 40px tall and shows project name", () => {
    renderBar();
    const bar = screen.getByTestId("status-bar");
    expect(bar.className).toContain("h-[40px]");
    expect(screen.getByRole("button", { name: /demo-repo/i })).toBeTruthy();
  });

  it("shows Reconnecting when session store is reconnecting", () => {
    useSessionStore.setState({ connectionStatus: "reconnecting" });
    renderBar();
    expect(screen.getByText("Reconnecting")).toBeTruthy();
  });

  it("shows Connected when session store is connected", () => {
    useSessionStore.setState({ connectionStatus: "connected" });
    renderBar();
    expect(screen.getByText("Connected")).toBeTruthy();
  });

  it("shows model label from getModels hook", () => {
    renderBar();
    expect(screen.getByText("Claude 3.5 Sonnet")).toBeTruthy();
  });
});
