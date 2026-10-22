// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentConnectionGate } from "./AgentConnectionGate.tsx";

vi.mock("../hooks/useMobileUnsupported.ts", () => ({
  useMobileUnsupported: vi.fn(() => false),
}));

vi.mock("../hooks/useAgentConnectionMonitor.ts", () => ({
  useAgentConnectionMonitor: vi.fn(),
}));

import { useAgentConnectionMonitor } from "../hooks/useAgentConnectionMonitor.ts";

describe("AgentConnectionGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows workspace when agent is online", () => {
    vi.mocked(useAgentConnectionMonitor).mockReturnValue({
      online: true,
      offlineReason: "agent-not-running",
      exiting: false,
    });

    render(
      <AgentConnectionGate>
        <p>Workspace ready</p>
      </AgentConnectionGate>,
    );

    expect(screen.getByText("Workspace ready")).toBeTruthy();
  });

  it("shows offline screen when agent is unreachable", () => {
    vi.mocked(useAgentConnectionMonitor).mockReturnValue({
      online: false,
      offlineReason: "agent-not-running",
      exiting: false,
    });

    render(
      <AgentConnectionGate>
        <p>Workspace ready</p>
      </AgentConnectionGate>,
    );

    expect(screen.getByRole("heading", { name: /Vibefork Agent не запущен/i })).toBeTruthy();
    expect(screen.queryByText("Workspace ready")).toBeNull();
  });
});
