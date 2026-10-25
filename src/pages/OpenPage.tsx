import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n/index.ts";
import { useAgentClient } from "../client/react/useAgentClient.ts";
import { AgentApiError } from "../client/types.ts";
import { useProjectStore } from "../stores/projectStore.ts";

export { buildLogLine } from "../stores/buildStore.ts";

type DeviceFlow =
  | { status: "idle" }
  | { status: "pending"; userCode: string; verificationUri: string }
  | { status: "success" }
  | { status: "error"; message: string };

type Phase =
  | { kind: "ready" }
  | { kind: "importing" }
  | {
      kind: "rate_limited";
      resetMinutes: number;
      deviceFlow: DeviceFlow;
    }
  | { kind: "failed"; error: string };

const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

function extractRateLimit(e: unknown): { isRateLimited: boolean; minutes: number } {
  if (e instanceof AgentApiError) {
    if (e.code === "rate_limit" || e.status === 429) {
      return { isRateLimited: true, minutes: e.resetMinutes ?? 60 };
    }
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (
    msg.toLowerCase().includes("limit of requests is reached") ||
    msg.toLowerCase().includes("rate limit") ||
    msg.includes("429")
  ) {
    const match = msg.match(/in (\d+) min/i);
    const minutes = match ? parseInt(match[1], 10) : 60;
    return { isRateLimited: true, minutes };
  }
  return { isRateLimited: false, minutes: 0 };
}

function PendingDeviceFlow({
  flow,
  copied,
  onCopy,
  t,
}: {
  flow: { userCode: string; verificationUri: string };
  copied: boolean;
  onCopy: (code: string) => void;
  t: (key: any, params?: any) => string;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-amber-700/30">
      <p className="text-sm text-neutral-200">
        {t("open.deviceCodePrompt")}
      </p>
      <div className="flex items-center gap-2">
        <code
          data-testid="github-user-code"
          className="rounded bg-neutral-900 border border-neutral-700 px-3 py-1.5 text-base font-mono font-bold tracking-wider text-amber-300 select-all"
        >
          {flow.userCode}
        </code>
        <button
          type="button"
          className="rounded border border-neutral-700 hover:border-neutral-600 text-neutral-300 px-2.5 py-1.5 text-xs transition-colors"
          onClick={() => onCopy(flow.userCode)}
        >
          {copied ? t("common.copied") : t("common.copy")}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <a
          href={flow.verificationUri}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded bg-amber-500 hover:bg-amber-400 text-neutral-950 font-medium px-3 py-1.5 text-sm transition-colors"
        >
          {t("open.openVerificationPage")}
        </a>
        <span className="text-xs text-neutral-400 animate-pulse">
          {t("open.waitingForAuthorization")}
        </span>
      </div>
    </div>
  );
}

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
  const [copied, setCopied] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

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
    stopPolling();
    setPhase({ kind: "importing" });
    try {
      const result = await client.importProject({ repo, ref, upstream });
      if (result.foreign) {
        useProjectStore.getState().setForeignChanges(result.project, result.foreign);
      }
      navigate(`/${result.project}`, { replace: true });
    } catch (e) {
      const rateLimit = extractRateLimit(e);
      if (rateLimit.isRateLimited) {
        setPhase({
          kind: "rate_limited",
          resetMinutes: rateLimit.minutes,
          deviceFlow: { status: "idle" },
        });
      } else {
        setPhase({ kind: "failed", error: e instanceof Error ? e.message : String(e) });
      }
    }
  };

  const startGithubConnect = async (resetMinutes: number) => {
    stopPolling();
    try {
      const resp = await client.connectGithub();
      setPhase({
        kind: "rate_limited",
        resetMinutes,
        deviceFlow: {
          status: "pending",
          userCode: resp.userCode,
          verificationUri: resp.verificationUri,
        },
      });

      pollTimerRef.current = setInterval(async () => {
        try {
          const status = await client.getGithubStatus();
          if (status.connected) {
            stopPolling();
            setPhase({
              kind: "rate_limited",
              resetMinutes,
              deviceFlow: { status: "success" },
            });
            await takeCode();
          } else if (status.error) {
            stopPolling();
            setPhase({
              kind: "rate_limited",
              resetMinutes,
              deviceFlow: { status: "error", message: status.error },
            });
          }
        } catch {
          // ignore transient poll errors
        }
      }, 2000);
    } catch (e) {
      setPhase({
        kind: "rate_limited",
        resetMinutes,
        deviceFlow: {
          status: "error",
          message: e instanceof Error ? e.message : String(e),
        },
      });
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
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

      {phase.kind === "rate_limited" ? (
        <div
          role="region"
          aria-label={t("open.rateLimitTitle")}
          className="rounded-lg border border-amber-600/40 bg-amber-950/20 p-4 space-y-3"
        >
          <div className="space-y-1">
            <p className="text-base font-semibold text-amber-300">
              {t("open.rateLimitTitle")}
            </p>
            <p className="text-sm text-neutral-300">
              {t("open.rateLimitWait", { minutes: phase.resetMinutes })}
            </p>
            <p className="text-xs text-neutral-400">
              {t("open.rateLimitNotice")}
            </p>
          </div>

          {phase.deviceFlow.status === "idle" ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                className="rounded bg-amber-500 hover:bg-amber-400 text-neutral-950 font-medium px-3 py-1.5 text-sm transition-colors"
                onClick={() => startGithubConnect(phase.resetMinutes)}
              >
                {t("open.rateLimitConnectAction")}
              </button>
              <button
                type="button"
                className="rounded border border-neutral-600 hover:border-neutral-500 text-neutral-300 px-3 py-1.5 text-sm transition-colors"
                onClick={takeCode}
              >
                {t("open.rateLimitRetryAction")}
              </button>
            </div>
          ) : null}

          {phase.deviceFlow.status === "pending" ? (
            <PendingDeviceFlow
              flow={phase.deviceFlow}
              copied={copied}
              onCopy={handleCopyCode}
              t={t}
            />
          ) : null}

          {phase.deviceFlow.status === "success" ? (
            <div className="pt-1">
              <p className="text-sm text-emerald-400 font-medium">
                {t("open.connectedRetrying")}
              </p>
            </div>
          ) : null}

          {phase.deviceFlow.status === "error" ? (
            <div className="space-y-2 pt-1">
              <p className="text-sm text-red-400">{phase.deviceFlow.message}</p>
              <button
                type="button"
                className="rounded bg-amber-500 hover:bg-amber-400 text-neutral-950 font-medium px-3 py-1.5 text-sm transition-colors"
                onClick={() => startGithubConnect(phase.resetMinutes)}
              >
                {t("open.rateLimitConnectAction")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

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
