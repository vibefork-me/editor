// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useProjectStore } from "../../stores/projectStore.ts";
import { useSessionStore } from "../../stores/sessionStore.ts";
import { StatusBar } from "./StatusBar.tsx";

vi.mock("../../hooks/useModelLabel.ts", () => ({
  useModelLabel: () => ({ name: "Claude", model: "Claude 3.5 Sonnet" }),
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

  it("says the connection dropped while the task socket reconnects", () => {
    useSessionStore.setState({ connectionStatus: "reconnecting" });
    renderBar();
    expect(screen.getByText(/Связь прервалась|Connection lost/)).toBeTruthy();
  });

  it("says the agent is running when connected, with a plain hint", () => {
    useSessionStore.setState({ connectionStatus: "connected" });
    renderBar();
    const label = screen.getByText(/Агент работает|Agent is running/);
    expect(label.closest("[title]")?.getAttribute("title")).toMatch(/Vibefork/);
  });

  it("never says Offline: the page is shown only while the agent answers", () => {
    useSessionStore.setState({ connectionStatus: "disconnected" });
    renderBar();
    expect(screen.queryByText(/Offline/)).toBeNull();
  });

  it("names the AI, with the model in the hint", () => {
    renderBar();
    const ai = screen.getByText(/(ИИ|AI): Claude/);
    expect(ai.getAttribute("title")).toContain("Claude 3.5 Sonnet");
  });
});
