import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n/index.ts";
import { useAgentClient } from "../client/react/useAgentClient.ts";
import { useProjectStore } from "../stores/projectStore.ts";

export { buildLogLine } from "../stores/buildStore.ts";

type Phase =
  | { kind: "ready" }
  | { kind: "importing" }
  | { kind: "failed"; error: string };

const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

/** `/open?repo=…&ref=…&upstream=…` from the site: take the code, navigate to workspace. */
export function OpenPage() {
  const { t } = useI18n();
  const client = useAgentClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const repo = params.get("repo") ?? "";
  const ref = params.get("ref") ?? undefined;
  const upstream = params.get("upstream") ?? undefined;
  const path = params.get("path");
  const foreignHint = Boolean(ref?.startsWith("pull/")) || (upstream !== undefined && upstream !== repo);
  const [phase, setPhase] = useState<Phase>({ kind: "ready" });

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
      if (result.foreign) {
        useProjectStore.getState().setForeignChanges(result.foreign);
      }
      navigate(`/${result.project}`, { replace: true });
    } catch (e) {
      setPhase({ kind: "failed", error: e instanceof Error ? e.message : String(e) });
    }
  };

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
        {foreignHint ? (
          <p role="note" className="text-sm font-medium text-amber-400">
            {t("open.notOriginal")}
            {upstream ? ` ${t("open.originalLabel")} ${upstream}` : null}
          </p>
        ) : null}
      </div>

      {phase.kind === "ready" ? (
        <button
          type="button"
          className="rounded bg-neutral-200 px-3 py-1.5 text-sm text-neutral-900 font-medium hover:bg-neutral-100 transition-colors"
          onClick={takeCode}
        >
          {t("open.takeCode")}
        </button>
      ) : null}
      {phase.kind === "importing" ? <p className="text-sm text-neutral-400">{t("open.importing")}</p> : null}

      {phase.kind === "failed" ? (
        <p className="text-sm text-red-400" role="alert">
          {phase.error}
        </p>
      ) : null}

      <div>
        <Link className="text-sm text-neutral-400 underline" to="/">
          {t("common.backToHome")}
        </Link>
      </div>
    </div>
  );
}
