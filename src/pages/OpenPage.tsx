import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n/index.ts";
import { useAgentClient } from "../client/react/useAgentClient.ts";
import type { BuildMessage, BuildOutcome, ImportProjectResult } from "../client/types.ts";

type Phase =
  | { kind: "ready" }
  | { kind: "importing" }
  | { kind: "imported"; result: ImportProjectResult }
  | { kind: "building"; result: ImportProjectResult }
  | { kind: "built"; result: ImportProjectResult; outcome: BuildOutcome }
  | { kind: "failed"; error: string };

const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

/** One readable line of a build message (agent `ServerMessage`). */
export function buildLogLine(m: BuildMessage): string | null {
  switch (m.type) {
    case "estimate":
    case "build_log":
    case "stderr":
      return m.text;
    case "toolchain":
      return `${m.tool}: ${m.status}${m.error ? ` — ${m.error}` : ""}`;
    default:
      return null;
  }
}

/** `/open?repo=…&ref=…&upstream=…` from the site: take the code, show what it changes, build. */
export function OpenPage() {
  const { t } = useI18n();
  const client = useAgentClient();
  const [params] = useSearchParams();
  const repo = params.get("repo") ?? "";
  const ref = params.get("ref") ?? undefined;
  const upstream = params.get("upstream") ?? undefined;
  const path = params.get("path");
  const foreignHint = Boolean(ref?.startsWith("pull/")) || (upstream !== undefined && upstream !== repo);
  const [phase, setPhase] = useState<Phase>({ kind: "ready" });
  const [log, setLog] = useState<string[]>([]);

  if (!REPO_RE.test(repo)) {
    return (
      <div className="text-center space-y-4 max-w-lg">
        <p className="text-xl font-medium text-neutral-200">{t("open.title")}</p>
        <p className="text-sm text-neutral-400">{t("open.missingRepo")}</p>
        <Link className="text-sm text-neutral-400 underline" to="/">
          {t("common.backToHome")}
        </Link>
      </div>
    );
  }

  const takeCode = async () => {
    setPhase({ kind: "importing" });
    try {
      const result = await client.importProject({ repo, ref, upstream });
      setPhase({ kind: "imported", result });
    } catch (e) {
      setPhase({ kind: "failed", error: e instanceof Error ? e.message : String(e) });
    }
  };

  const build = async (result: ImportProjectResult) => {
    setLog([]);
    setPhase({ kind: "building", result });
    try {
      const outcome = await client.runBuild(result.project, (m) => {
        const line = buildLogLine(m);
        if (line) setLog((l) => [...l.slice(-199), line]);
      });
      setPhase({ kind: "built", result, outcome });
    } catch (e) {
      setPhase({ kind: "failed", error: e instanceof Error ? e.message : String(e) });
    }
  };

  const result = "result" in phase ? phase.result : null;
  const foreign = result?.foreign;

  return (
    <div className="space-y-4 max-w-xl w-full">
      <p className="text-xl font-medium text-neutral-200">{t("open.title")}</p>
      <div className="rounded border border-neutral-700 p-3 space-y-1">
        <p className="text-sm text-neutral-300 break-all font-mono">{repo}</p>
        {ref ? (
          <p className="text-sm text-neutral-500">
            {t("open.refLabel")} <span className="font-mono">{ref}</span>
          </p>
        ) : null}
        {path ? (
          <p className="text-sm text-neutral-500">
            {t("open.pathLabel")} <span className="font-mono">{path}</span>
          </p>
        ) : null}
        {foreignHint || foreign ? (
          <p role="note" className="text-sm font-medium text-amber-400">
            {t("open.notOriginal")}
            {upstream ? ` ${t("open.originalLabel")} ${upstream}` : null}
          </p>
        ) : null}
      </div>

      {phase.kind === "ready" ? (
        <button type="button" className="rounded bg-neutral-200 px-3 py-1.5 text-sm text-neutral-900" onClick={takeCode}>
          {t("open.takeCode")}
        </button>
      ) : null}
      {phase.kind === "importing" ? <p className="text-sm text-neutral-400">{t("open.importing")}</p> : null}

      {foreign ? (
        <div className="rounded border border-amber-700 p-3 space-y-2" data-testid="foreign-summary">
          <p className="text-sm text-neutral-200">
            {t("open.changedFiles")} {foreign.files}
          </p>
          {(
            [
              ["open.changesDependencies", foreign.dependencies],
              ["open.changesBuildScripts", foreign.buildScripts],
              ["open.changesBinaries", foreign.binaries],
            ] as const
          ).map(([key, list]) =>
            list.length > 0 ? (
              <p key={key} className="text-sm text-amber-300 break-all">
                {t(key)} <span className="font-mono">{list.join(", ")}</span>
              </p>
            ) : null,
          )}
          {!foreign.complete ? <p className="text-sm text-amber-300">{t("open.incompleteCheck")}</p> : null}
          <a className="text-sm text-neutral-400 underline" href={foreign.compareUrl} target="_blank" rel="noreferrer">
            {t("open.viewChanges")}
          </a>
        </div>
      ) : null}

      {phase.kind === "imported" ? (
        <div className="space-y-2">
          <p className="text-sm text-neutral-400">
            {t("open.projectReady")} <span className="font-mono">{phase.result.project}</span>
          </p>
          <button
            type="button"
            className="rounded bg-neutral-200 px-3 py-1.5 text-sm text-neutral-900"
            onClick={() => build(phase.result)}
          >
            {t("open.build")}
          </button>
          <p className="text-xs text-neutral-500">{t("open.buildConfirmNote")}</p>
        </div>
      ) : null}

      {phase.kind === "building" || phase.kind === "built" ? (
        <pre className="max-h-64 overflow-auto rounded bg-neutral-900 p-2 text-xs text-neutral-300" data-testid="build-log">
          {log.join("\n") || t("open.building")}
        </pre>
      ) : null}
      {phase.kind === "built" ? (
        <p className="text-sm text-neutral-200" role="status">
          {phase.outcome.kind === "done" && phase.outcome.code === 0
            ? `${t("open.buildSucceeded")}${phase.outcome.artifacts ? ` ${phase.outcome.artifacts}` : ""}`
            : phase.outcome.kind === "error"
              ? `${t("open.buildFailed")} ${phase.outcome.error}`
              : phase.outcome.kind === "cancelled"
                ? t("open.buildCancelled")
                : `${t("open.buildFailed")} ${phase.outcome.code}`}
        </p>
      ) : null}
      {phase.kind === "failed" ? (
        <p className="text-sm text-red-400" role="alert">
          {phase.error}
        </p>
      ) : null}

      <Link className="text-sm text-neutral-400 underline" to="/">
        {t("common.backToHome")}
      </Link>
    </div>
  );
}
