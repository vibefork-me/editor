/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useI18nStore } from "../../i18n/i18nStore.ts";
import { useBuildStore } from "../../stores/buildStore.ts";
import { useProjectStore } from "../../stores/projectStore.ts";
import { bindAgentTransport } from "../../stores/agent-bridge.ts";
import { ForeignChangesBanner } from "./ForeignChangesBanner.tsx";
import { BuildPanel } from "./BuildPanel.tsx";
import { StatusBar } from "./StatusBar.tsx";
import type { AgentTransport, BuildMessage, BuildOutcome } from "../../client/types.ts";

vi.mock("../../hooks/useModelLabel.ts", () => ({
  useModelLabel: () => "Claude 3.5 Sonnet",
}));

vi.mock("../../client/react/useAgentClient.ts", () => ({
  useAgentClient: () => ({
    listProjects: vi.fn().mockResolvedValue([]),
  }),
}));

describe("Workspace build and foreign changes flow", () => {
  beforeEach(() => {
    useI18nStore.getState().setLocale("en");
    useBuildStore.getState().resetBuild();
    useProjectStore.setState({
      currentProjectId: "test-proj",
      projectMeta: { projectId: "test-proj" },
      foreignChanges: null,
    });
  });

  describe("ForeignChangesBanner", () => {
    const mockForeign = {
      source: "upstream@pull/5",
      files: 4,
      dependencies: ["Cargo.toml"],
      buildScripts: ["build.rs"],
      binaries: ["vendor.so"],
      complete: false,
      compareUrl: "https://github.com/test/compare",
    };

    it("renders foreign code warning, changed files, dependencies, and scripts", () => {
      const handleDismiss = vi.fn();
      const handleBuild = vi.fn();

      render(
        <ForeignChangesBanner
          foreign={mockForeign}
          onDismiss={handleDismiss}
          onBuild={handleBuild}
        />
      );

      expect(screen.getByTestId("foreign-summary")).toBeTruthy();
      expect(screen.getByText(/code not from the original/i)).toBeTruthy();
      expect(screen.getByText("4")).toBeTruthy();
      expect(screen.getByText(/Cargo.toml/)).toBeTruthy();
      expect(screen.getByText(/build.rs/)).toBeTruthy();
      expect(screen.getByText(/vendor.so/)).toBeTruthy();
      expect(screen.getByText(/Not every changed file was checked/i)).toBeTruthy();

      const buildBtn = screen.getByRole("button", { name: /build/i });
      fireEvent.click(buildBtn);
      expect(handleBuild).toHaveBeenCalledTimes(1);

      const dismissBtn = screen.getByRole("button", { name: /dismiss/i });
      fireEvent.click(dismissBtn);
      expect(handleDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe("BuildPanel and buildStore in workspace", () => {
    it("runs build, streams logs, and shows artifact path with copy button on success", async () => {
      const mockRunBuild = vi.fn(async (_project: string, onMessage: (m: BuildMessage) => void): Promise<BuildOutcome> => {
        onMessage({ type: "estimate", verdict: "ok", text: "Toolchain ready" });
        onMessage({ type: "build_log", text: "Compiling crates..." });
        return {
          kind: "done",
          code: 0,
          artifacts: "D:/Projects/app/target/release/app.exe",
          files: ["app.exe"],
        };
      });

      const mockTransport = {
        runBuild: mockRunBuild,
      } as unknown as AgentTransport;

      bindAgentTransport(mockTransport);

      render(<BuildPanel />);

      // Starts build
      const buildPromise = useBuildStore.getState().startBuild("test-proj");

      await waitFor(() => {
        expect(screen.getByTestId("build-panel")).toBeTruthy();
        expect(screen.getByText(/Compiling crates.../)).toBeTruthy();
      });

      const outcome = await buildPromise;
      expect(outcome?.kind).toBe("done");

      await waitFor(() => {
        expect(screen.getAllByText(/Build ready/i).length).toBeGreaterThan(0);
        expect(screen.getByText("D:/Projects/app/target/release/app.exe")).toBeTruthy();
      });

      // Test clipboard copy
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });

      const copyBtns = screen.getAllByRole("button", { name: /copy path/i });
      expect(copyBtns.length).toBeGreaterThan(0);
      fireEvent.click(copyBtns[0]);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          "D:/Projects/app/target/release/app.exe"
        );
      });
    });

    it("surfaces human-readable error callout on build failure", async () => {
      const mockRunBuild = vi.fn(async (): Promise<BuildOutcome> => {
        return {
          kind: "error",
          error: "Compiler crashed: missing header sys/socket.h",
        };
      });

      const mockTransport = {
        runBuild: mockRunBuild,
      } as unknown as AgentTransport;

      bindAgentTransport(mockTransport);

      render(<BuildPanel />);

      await useBuildStore.getState().startBuild("test-proj");

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeTruthy();
        expect(
          screen.getByText(/Compiler crashed: missing header sys\/socket.h/i)
        ).toBeTruthy();
      });
    });
  });

  describe("StatusBar build trigger", () => {
    it("renders build button and triggers build when clicked", async () => {
      const mockRunBuild = vi.fn(async (): Promise<BuildOutcome> => {
        return { kind: "done", code: 0, files: [] };
      });

      const mockTransport = {
        runBuild: mockRunBuild,
        listProjects: vi.fn().mockResolvedValue([]),
      } as unknown as AgentTransport;

      bindAgentTransport(mockTransport);

      render(
        <MemoryRouter>
          <StatusBar />
        </MemoryRouter>
      );

      const statusBuildBtn = screen.getByTestId("status-build-button");
      expect(statusBuildBtn).toBeTruthy();

      fireEvent.click(statusBuildBtn);

      await waitFor(() => {
        expect(mockRunBuild).toHaveBeenCalledWith("test-proj", expect.any(Function));
      });
    });
  });
});
