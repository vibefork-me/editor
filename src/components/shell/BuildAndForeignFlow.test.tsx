/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useI18nStore } from "../../i18n/i18nStore.ts";
import { useBuildStore } from "../../stores/buildStore.ts";
import { useProjectStore } from "../../stores/projectStore.ts";
import { bindAgentTransport } from "../../stores/agent-bridge.ts";
import { ForeignChangesBanner } from "./ForeignChangesBanner.tsx";
import { JournalPanel } from "../workspace/JournalPanel.tsx";
import { useLayoutStore } from "../../stores/layoutStore.ts";
import { initialCanvasState } from "../../canvas/canvasState.ts";
import type { AgentTransport, BuildMessage, BuildOutcome } from "../../client/types.ts";

vi.mock("../../hooks/useModelLabel.ts", () => ({
  useModelLabel: () => ({ name: "Claude", model: "Claude 3.5 Sonnet" }),
}));

vi.mock("../../client/react/useAgentClient.ts", () => ({
  useAgentClient: () => ({
    listProjects: vi.fn().mockResolvedValue([]),
  }),
}));

/** The Journal open on its build section. */
function BuildJournal() {
  useLayoutStore.getState().setJournalTab("build");
  return <JournalPanel feed={[]} taskStatus={null} state={initialCanvasState} errors={{ agent: false, build: false, program: false }} />;
}

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

    it("clears foreign changes when switching to another project (Point 1)", async () => {
      useProjectStore.getState().setForeignChanges("project-A", mockForeign);
      expect(useProjectStore.getState().foreignChanges?.project).toBe("project-A");

      // Switching to project-B clears foreign changes
      await useProjectStore.getState().selectProject("project-B");
      expect(useProjectStore.getState().foreignChanges).toBeNull();
    });

    it("retains foreign changes when selecting the same project (Point 1)", async () => {
      useProjectStore.getState().setForeignChanges("project-A", mockForeign);
      expect(useProjectStore.getState().foreignChanges?.project).toBe("project-A");

      // Selecting the same project keeps foreign changes
      await useProjectStore.getState().selectProject("project-A");
      expect(useProjectStore.getState().foreignChanges?.project).toBe("project-A");
      expect(useProjectStore.getState().foreignChanges?.foreign.files).toBe(4);
    });
  });

  describe("Journal build section and buildStore in workspace", () => {
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

      render(<BuildJournal />);

      // Starts build
      const buildPromise = useBuildStore.getState().startBuild("test-proj");

      await waitFor(() => {
        expect(screen.getByTestId("build-section")).toBeTruthy();
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

      render(<BuildJournal />);

      await useBuildStore.getState().startBuild("test-proj");

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeTruthy();
        expect(
          screen.getByText(/Compiler crashed: missing header sys\/socket.h/i)
        ).toBeTruthy();
      });
    });

    it("displays localized error message and hides raw technical exit code on non-zero exit", async () => {
      const mockRunBuild = vi.fn(async (_p: string, onMessage: (m: BuildMessage) => void): Promise<BuildOutcome> => {
        onMessage({ type: "stderr", text: "error[E0432]: unresolved import `foo`" });
        return {
          kind: "done",
          code: 101,
          files: [],
        };
      });

      const mockTransport = {
        runBuild: mockRunBuild,
      } as unknown as AgentTransport;

      bindAgentTransport(mockTransport);

      render(<BuildJournal />);

      await useBuildStore.getState().startBuild("test-proj");

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeTruthy();
        // Localized EN message
        expect(screen.getByText(/Build failed\. See the log above for details\./i)).toBeTruthy();
        // Technical exit code string must NOT be in alert
        expect(screen.queryByText(/Build process exited with code 101/i)).toBeNull();
      });

      // Also verify RU localization
      useI18nStore.getState().setLocale("ru");
      await waitFor(() => {
        expect(
          screen.getByText(/Сборка завершилась с ошибкой\. Подробности — в логе выше\./i)
        ).toBeTruthy();
      });
      useI18nStore.getState().setLocale("en");
    });

    it("displays localized error message when build is not confirmed", async () => {
      const mockRunBuild = vi.fn(async (): Promise<BuildOutcome> => {
        return {
          kind: "error",
          error: "build not confirmed",
          code: "build_not_confirmed",
        };
      });

      const mockTransport = {
        runBuild: mockRunBuild,
      } as unknown as AgentTransport;

      bindAgentTransport(mockTransport);

      render(<BuildJournal />);

      await useBuildStore.getState().startBuild("test-proj");

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeTruthy();
        expect(screen.getByText(/Build was not confirmed in the agent dialog\./i)).toBeTruthy();
      });

      useI18nStore.getState().setLocale("ru");
      await waitFor(() => {
        expect(
          screen.getByText(/Сборка не была подтверждена в окне агента\./i)
        ).toBeTruthy();
      });
      useI18nStore.getState().setLocale("en");
    });

    it("words a build error with a known code in the person's language", async () => {
      const mockTransport = {
        runBuild: vi.fn(async (): Promise<BuildOutcome> => ({
          kind: "error",
          error: "no known way to build this project",
          code: "no_build_recipe",
        })),
      } as unknown as AgentTransport;
      bindAgentTransport(mockTransport);
      render(<BuildJournal />);
      await useBuildStore.getState().startBuild("test-proj");

      await waitFor(() => {
        expect(screen.getByText("The agent does not know how to build this project")).toBeTruthy();
      });
      useI18nStore.getState().setLocale("ru");
      await waitFor(() => {
        expect(screen.getByText("Агент не знает, как собрать этот проект")).toBeTruthy();
      });
      useI18nStore.getState().setLocale("en");
    });

    it("displays localized error message when agent transport is offline", async () => {
      bindAgentTransport(null as unknown as AgentTransport);

      render(<BuildJournal />);

      await useBuildStore.getState().startBuild("test-proj");

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeTruthy();
        expect(screen.getByText(/No connection to local agent\./i)).toBeTruthy();
      });
    });

    it("isolates build logs and outcome between projects (Point 5)", async () => {
      let emitMessage: (m: BuildMessage) => void = () => {};
      let resolveBuild: (outcome: BuildOutcome) => void = () => {};

      const mockRunBuild = vi.fn((_p: string, onMessage: (m: BuildMessage) => void) => {
        emitMessage = onMessage;
        return new Promise<BuildOutcome>((resolve) => {
          resolveBuild = resolve;
        });
      });

      const mockTransport = {
        runBuild: mockRunBuild,
      } as unknown as AgentTransport;

      bindAgentTransport(mockTransport);

      // Start build on project-A
      const buildPromise = useBuildStore.getState().startBuild("project-A");
      expect(useBuildStore.getState().status).toBe("building");
      expect(useBuildStore.getState().buildingProjectId).toBe("project-A");

      // While build is running on project-A, user switches to project-B
      useBuildStore.getState().setActiveProject("project-B");

      // Build state for active project-B is idle
      expect(useBuildStore.getState().status).toBe("idle");
      expect(useBuildStore.getState().log).toEqual([]);

      // Late message arrives from project-A
      emitMessage({ type: "build_log", text: "Compiling crates for project-A..." });

      // Must be ignored because active project is project-B
      expect(useBuildStore.getState().log).toEqual([]);

      // Build finishes for project-A
      resolveBuild({
        kind: "done",
        code: 0,
        artifacts: "/path/to/project-A.exe",
        files: ["project-A.exe"],
      });
      await buildPromise;

      // Active project-B must NOT have project-A's status or outcome
      expect(useBuildStore.getState().status).toBe("idle");
      expect(useBuildStore.getState().outcome).toBeNull();
    });
  });

  describe("Journal build trigger", () => {
    it("renders build button and triggers build when clicked", async () => {
      const mockRunBuild = vi.fn(async (): Promise<BuildOutcome> => {
        return { kind: "done", code: 0, files: [] };
      });

      const mockTransport = {
        runBuild: mockRunBuild,
        listProjects: vi.fn().mockResolvedValue([]),
      } as unknown as AgentTransport;

      bindAgentTransport(mockTransport);

      useLayoutStore.getState().setJournalTab("build");
      render(
        <MemoryRouter>
          <JournalPanel feed={[]} taskStatus={null} state={initialCanvasState} errors={{ agent: false, build: false, program: false }} />
        </MemoryRouter>
      );

      const statusBuildBtn = screen.getByTestId("build-button");
      expect(statusBuildBtn).toBeTruthy();

      fireEvent.click(statusBuildBtn);

      await waitFor(() => {
        expect(mockRunBuild).toHaveBeenCalledWith("test-proj", expect.any(Function));
      });
    });
  });
});
