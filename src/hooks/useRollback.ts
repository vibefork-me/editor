import { useCallback, useEffect, useRef, useState } from "react";
import { AgentApiError, type JournalEntry } from "../client/types.ts";
import type { TranslationKey } from "../i18n/types.ts";
import { getAgentTransport } from "../stores/agent-bridge.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useGraphStore } from "../stores/graphStore.ts";

/** Where a rollback is: waiting for the person in the agent's window, done, or failed with a reason. */
export type RollbackStatus = { state: "confirm" } | { state: "done" } | { state: "failed"; reason: TranslationKey };

/** A checkpoint of the project the person can return to: one journal entry with its commit. */
export interface ProjectVersion {
  commit: string;
  at: string;
  /** The task or plan step; empty for a part put back by the agent. */
  title: string;
  /** The agent put a part back here (no task text to show). */
  rollback: boolean;
  /** The project is at this version: nothing after it in the journal. */
  current: boolean;
}

/** What the person reads when a rollback did not happen; `what` names the part or the version. */
export function rollbackReason(code: string | null | undefined, error: string, what: "part" | "version"): TranslationKey {
  switch (code) {
    case "nothing_to_roll_back":
      return "card.undoNothing";
    case "rollback_not_confirmed":
      return "card.rollbackNotConfirmed";
    case "not_supported":
      return "card.rollbackNotSupported";
    case "not_found":
      return what === "part" ? "card.undoNotFound" : "taskView.restoreNotFound";
    case "task_already_running":
      return "card.rollbackBusy";
    case "project_forbidden":
      return "card.rollbackForbidden";
  }
  // The agent answers a running task in the project without a code.
  if (/\brunning\b/i.test(error)) return "card.rollbackBusy";
  return "card.rollbackFailed";
}

/** Journal entries with a checkpoint, newest first. */
export function projectVersions(entries: JournalEntry[]): ProjectVersion[] {
  const last = entries[entries.length - 1];
  return entries
    .filter((e) => e.commit)
    .map((e) => ({
      commit: e.commit as string,
      at: e.at,
      title: e.provider === "rollback" ? "" : e.prompt,
      rollback: e.provider === "rollback",
      current: e === last,
    }))
    .reverse();
}

/**
 * Rolling back in a project: one part as it was before the last task that changed it, or the whole
 * project to a version of its journal. The agent asks the person in its own window first; after a
 * rollback the map, the canvas and the versions are read again.
 */
export function useRollback(projectId: string | null) {
  const [part, setPart] = useState<{ id: string; status: RollbackStatus } | null>(null);
  const [version, setVersion] = useState<{ commit: string; status: RollbackStatus } | null>(null);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const busy = useRef(false);

  const loadVersions = useCallback(async () => {
    const transport = getAgentTransport();
    if (!projectId || typeof transport?.getJournal !== "function") return;
    try {
      const journal = await transport.getJournal(projectId);
      setVersions(projectVersions(journal.entries));
    } catch {
      // An agent without the journal: no versions to return to.
      setVersions([]);
    }
  }, [projectId]);

  useEffect(() => {
    setPart(null);
    setVersion(null);
    setVersions([]);
    void loadVersions();
  }, [loadVersions]);

  const afterRollback = useCallback(() => {
    void useGraphStore.getState().refreshGraph();
    void useCanvasStore.getState().refresh();
    void loadVersions();
  }, [loadVersions]);

  const undoPart = useCallback(
    async (id: string) => {
      const transport = getAgentTransport();
      if (!projectId || !transport || busy.current) return;
      busy.current = true;
      setVersion(null);
      setPart({ id, status: { state: "confirm" } });
      try {
        const outcome = await transport.rollbackPart({ projectId, id }, (m) => {
          if (m.type === "canvas") useCanvasStore.getState().ingest(m);
        });
        if (outcome.kind === "done") {
          setPart({ id, status: { state: "done" } });
          afterRollback();
        } else {
          setPart({ id, status: { state: "failed", reason: rollbackReason(outcome.code, outcome.error, "part") } });
        }
      } catch {
        setPart({ id, status: { state: "failed", reason: "card.rollbackFailed" } });
      } finally {
        busy.current = false;
      }
    },
    [projectId, afterRollback],
  );

  const restoreVersion = useCallback(
    async (commit: string) => {
      const transport = getAgentTransport();
      if (!projectId || !transport || busy.current) return;
      busy.current = true;
      setPart(null);
      setVersion({ commit, status: { state: "confirm" } });
      try {
        await transport.rollback({ projectId, commit });
        setVersion({ commit, status: { state: "done" } });
        afterRollback();
      } catch (e) {
        const code = e instanceof AgentApiError ? e.code : undefined;
        setVersion({ commit, status: { state: "failed", reason: rollbackReason(code, e instanceof Error ? e.message : "", "version") } });
      } finally {
        busy.current = false;
      }
    },
    [projectId, afterRollback],
  );

  return { part, version, versions, undoPart, restoreVersion, loadVersions };
}
