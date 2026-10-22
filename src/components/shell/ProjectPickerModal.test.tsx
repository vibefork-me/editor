// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { bindAgentTransport } from "../../stores/agent-bridge.ts";
import { useProjectStore } from "../../stores/projectStore.ts";
import { ProjectPickerModal } from "./ProjectPickerModal.tsx";

describe("ProjectPickerModal", () => {
  beforeEach(() => {
    bindAgentTransport({
      listProjects: vi.fn(async () => [
        { projectId: "alpha", upstream: "org/alpha" },
        { projectId: "beta" },
      ]),
    } as never);
    useProjectStore.setState({
      grantedProjects: [],
      currentProjectId: null,
      isLoading: false,
    });
  });

  it("closes on Escape and lists projects", async () => {
    const onOpenChange = vi.fn();
    render(
      <MemoryRouter>
        <ProjectPickerModal open onOpenChange={onOpenChange} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("org/alpha")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(onOpenChange).toHaveBeenCalled();
  });
});
