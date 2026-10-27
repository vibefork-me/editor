import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Stage } from "../../client/protocol.generated.ts";
import { IconCheck } from "../../components/shell/icons.tsx";
import { formatNumber, unitName } from "../../i18n/format.ts";
import { useTranslation } from "../../i18n/i18nStore.ts";
import { etaLeft, type CanvasState } from "../canvasState.ts";

export const ANALYSIS_STAGES: Stage[] = ["download", "parts", "links", "tools", "summary"];
export const TASK_STAGES: Stage[] = ["understand", "plan", "change", "check", "done"];

// The line under the rail stays this long after a new stage when the agent neither thinks nor shows progress.
const STATUS_HOLD_MS = 6000;

type T = ReturnType<typeof useTranslation>["t"];

/** "N s left" under a minute; above, whole or half minutes, which read calmer than seconds. */
export function formatEta(t: T, seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return t("stages.etaSeconds", { n: s });
  return t("stages.etaMinutes", { n: Math.round(s / 30) / 2 });
}

function formatAmount(locale: string, v: number): string {
  return formatNumber(locale, v, { maximumFractionDigits: v >= 100 ? 0 : 1, useGrouping: false });
}

/** Done and total in the person's units and notation: bytes as KB or MB (`1.5 MB`, `1,5 МБ`). */
export function amounts(
  locale: string,
  done: number,
  total: number,
  unit: string,
): { done: string; total: string; unit: string } {
  if (unit !== "bytes") return { done: formatAmount(locale, done), total: formatAmount(locale, total), unit };
  const [div, name] = total >= 1024 * 1024 ? [1024 * 1024, "megabyte"] : [1024, "kilobyte"];
  return {
    done: formatAmount(locale, done / div),
    total: formatAmount(locale, total / div),
    unit: unitName(locale, name),
  };
}

export interface StageRailProps {
  state: CanvasState;
  /** Stream time now, Unix ms. */
  now: number;
  /** Shown while the agent works: it pauses at once, unlike messages. */
  onStop?: () => void;
}

/**
 * The stages of the analysis or of the task as a wizard (done, current, ahead), the overall time left and
 * "Stop"; under it, what the agent does now: a thought, or the current stage with its progress.
 */
export function StageRail({ state, now, onStop }: StageRailProps) {
  const { t, locale } = useTranslation();
  const statusKey = `${state.stage ?? ""}|${state.thinking?.text ?? ""}`;
  const [quiet, setQuiet] = useState(false);
  useEffect(() => {
    setQuiet(false);
    const timer = setTimeout(() => setQuiet(true), STATUS_HOLD_MS);
    return () => clearTimeout(timer);
  }, [statusKey]);

  // On a narrow screen labels go: first all but the current stage's (1), then all of them (2).
  const rowRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(0);
  useLayoutEffect(() => {
    const row = rowRef.current;
    const room = row?.parentElement?.clientWidth ?? 0;
    if (row && room > 0 && row.scrollWidth > room && compact < 2) setCompact(compact + 1);
  });
  useLayoutEffect(() => {
    const parent = rowRef.current?.parentElement;
    if (!parent || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setCompact(0));
    observer.observe(parent);
    return () => observer.disconnect();
  }, [state.stage !== null]);

  const stage = state.stage;
  if (!stage) return null;
  const inTask = TASK_STAGES.includes(stage);
  const stages = inTask ? TASK_STAGES : ANALYSIS_STAGES;
  const current = stages.indexOf(stage);
  const p = state.progress;
  const eta = etaLeft(state, now);
  const working = !state.result;

  return (
    <div className="pointer-events-none flex w-full flex-col items-center gap-2" data-testid="stage-rail">
      <div
        ref={rowRef}
        className="flex max-w-full items-center rounded-full border border-[#262b36] bg-[rgba(20,22,29,0.92)] px-2 py-1.5 backdrop-blur"
      >
        {inTask && (
          <>
            <Chip label={t("stages.analysis")} state="done" n={0} showLabel={compact === 0} />
            <span className="mx-1.5 h-[18px] w-px bg-[#30363d]" />
          </>
        )}
        {stages.map((s, i) => {
          const done = i < current || (s === "done" && i === current);
          const active = i === current && !done;
          return (
            <Fragment key={s}>
              {i > 0 && <span className={`h-0.5 w-3.5 rounded ${i <= current ? "bg-[#3fb950]" : "bg-[#30363d]"}`} />}
              <Chip
                label={t(`stages.${s}`)}
                state={done ? "done" : active ? "active" : "ahead"}
                n={i + 1}
                showLabel={compact === 0 || (compact === 1 && active)}
              />
            </Fragment>
          );
        })}
        {eta && eta.left >= 1 && stage !== "summary" && (
          <>
            <span className="mx-1.5 h-[18px] w-px bg-[#30363d]" />
            <span className="whitespace-nowrap px-2 text-xs tabular-nums text-[#c9d1d9]" data-testid="stage-eta">
              {compact < 2 && `${eta.scope === "analysis" ? t("stages.analysis") : t("stages.task")}: `}
              {formatEta(t, eta.left)}
            </span>
          </>
        )}
        {onStop && working && (
          <button
            type="button"
            onClick={onStop}
            title={t("stages.stopHint")}
            aria-label={t("stages.stop")}
            className="pointer-events-auto ml-1.5 flex items-center gap-1.5 rounded-full border border-[rgba(248,81,73,0.6)] bg-[rgba(248,81,73,0.1)] px-3 py-1 text-xs font-semibold text-[#ff7b72] hover:bg-[rgba(248,81,73,0.2)]"
          >
            <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-current" />
            {compact < 2 && t("stages.stop")}
          </button>
        )}
      </div>
      {(state.thinking || (p && p.done < p.total) || !quiet) && (
        <div
          key={state.thinking?.text ?? stage}
          data-testid="stage-now"
          className={`flex max-w-[820px] items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12.5px] shadow-lg ${
            state.thinking
              ? "border-[rgba(165,180,252,0.35)] bg-[linear-gradient(90deg,rgba(99,102,241,0.14),rgba(20,22,29,0.92)_60%)]"
              : "border-[#262b36] bg-[rgba(20,22,29,0.9)]"
          }`}
        >
          {state.thinking ? (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#a5b4fc]" />
              <span className="font-semibold text-[#a5b4fc]">{t("stages.thinking")}</span>
              <span className="truncate text-[#f0f3f6]">{state.thinking.text}</span>
            </>
          ) : (
            <>
              <span className={`h-[7px] w-[7px] rounded-full bg-[#58a6ff] shadow-[0_0_8px_rgba(88,166,255,0.8)] ${working ? "animate-pulse" : ""}`} />
              <span className="text-[#e6edf3]">{t(`stages.${stage}Long`)}</span>
            </>
          )}
          {p && (
            <>
              <span className="h-1.5 w-40 overflow-hidden rounded bg-[#262b36]">
                <span
                  className="block h-full bg-[linear-gradient(90deg,#388bfd,#58a6ff)] transition-[width] duration-300"
                  style={{ width: `${Math.min(100, (p.done / Math.max(1, p.total)) * 100)}%` }}
                />
              </span>
              <span className="truncate tabular-nums text-[#8b93a7]">
                {[
                  p.text,
                  p.unit && t("stages.amount", amounts(locale, p.done, p.total, p.unit)),
                  p.done < p.total && formatEta(t, p.eta),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ label, state, n, showLabel }: { label: string; state: "done" | "active" | "ahead"; n: number; showLabel: boolean }) {
  return (
    <span
      aria-current={state === "active" ? "step" : undefined}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-1 pr-2.5 text-xs ${
        state === "done" ? "text-[#8fd19e]" : state === "active" ? "bg-[rgba(56,139,253,0.18)] font-semibold text-[#f4f5f8]" : "text-[#6e7681]"
      }`}
    >
      <span
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[10px] ${
          state === "done"
            ? "border-[#2ea043] bg-[#238636] text-white"
            : state === "active"
              ? "border-[#58a6ff] bg-[#388bfd] text-white"
              : "border-[#30363d]"
        }`}
      >
        {state === "done" ? <IconCheck className="h-2.5 w-2.5" /> : n}
      </span>
      {showLabel && label}
    </span>
  );
}

/** Wall time, refreshed every second, for the time left on the rail. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
