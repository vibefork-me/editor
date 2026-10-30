import { useEffect, useRef, type ReactNode } from "react";
import type { ArtifactFile, CanvasRecord } from "../../client/protocol.generated.ts";
import { IconActivity, IconChevronDown, IconClose, IconCode, IconFile, IconLightbulb, IconNetwork } from "../../components/workspace/icons.tsx";
import type { RollbackStatus } from "../../hooks/useRollback.ts";
import { useTranslation } from "../../i18n/i18nStore.ts";
import { canvasNodes, type CanvasNodeView, type CanvasState } from "../canvasState.ts";
import type { GraphApi } from "../graph/GraphCanvas.tsx";
import { changesOf, partBadges, partHistory, relatedGroups, relatedParts, type Badge, type PartEvent } from "./partInfo.ts";

const TONE: Record<Badge["tone"], string> = {
  agent: "text-[#79c0ff] border-[#79c0ff66]",
  work: "text-[#58a6ff] border-[#58a6ff66]",
  failed: "text-[#ff7b72] border-[#ff7b7266]",
  changed: "text-[#f2cc60] border-[#f2cc6066]",
  task: "text-[#d2a8ff] border-[#d2a8ff66]",
  version: "text-[#56d4c4] border-[#56d4c466]",
};

export interface PartActions {
  /** Starts a message to the agent about the part. */
  onAsk: (prefix: string) => void;
  /** Has the agent explain the part in words, changing nothing; absent while a task runs. */
  onExplain?: (id: string) => void;
  /** An explanation is under way: the button waits. */
  explaining?: boolean;
  /** Opens a changed file's diff. */
  onShowChanges: (file: ArtifactFile) => void;
  /** Opens a file in the code viewer. */
  onOpenFile: (path: string) => void;
  /** Selects another part. */
  onGoTo: (id: string) => void;
  onClose: () => void;
}

/** Putting the part back as it was; absent while a task runs. `status`: of the last try for this part. */
export interface PartUndo {
  status: RollbackStatus | null;
  /** Another rollback is under way: the button waits. */
  disabled?: boolean;
  onUndo: () => void;
}

function Badges({ node }: { node: CanvasNodeView }) {
  const { t } = useTranslation();
  const badges = partBadges(node);
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((b) => (
        <span key={b.key} className={`rounded-full border px-2 py-px text-[10.5px] ${TONE[b.tone]}`}>
          {t(b.key)}
        </span>
      ))}
    </div>
  );
}

function Related({ state, node, onGoTo }: { state: CanvasState; node: CanvasNodeView; onGoTo: (id: string) => void }) {
  const { t } = useTranslation();
  const near = relatedParts(state, node.id).slice(0, 8);
  if (near.length === 0) return null;
  return (
    <div>
      <div className="mb-1 text-[10.5px] uppercase tracking-wide text-[#8b93a7]">{t("card.relatedTo")}</div>
      <div className="flex flex-wrap gap-1">
        {near.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => onGoTo(n.id)}
            className="rounded-full border border-[#30363d] bg-[#14161d] px-2 py-0.5 text-[11.5px] text-[#c9d1d9] hover:border-[#58a6ff]"
          >
            {n.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const actionClass =
  "flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#1b1f28] px-2.5 py-1.5 text-left text-[12.5px] text-[#e6edf3] hover:border-[#58a6ff] disabled:cursor-wait disabled:opacity-60";

/** "Explain this part": the answer comes in words in the conversation; nothing in the project changes. */
function ExplainAction({ nodeId, actions }: { nodeId: string; actions: Pick<PartActions, "onExplain" | "explaining"> }) {
  const { t } = useTranslation();
  const onExplain = actions.onExplain;
  if (!onExplain) return null;
  return (
    <button type="button" className={actionClass} disabled={actions.explaining} title={t("messages.explainHint")} onClick={() => onExplain(nodeId)}>
      {t("card.explain")}
    </button>
  );
}

/** "Put it back as it was", and how the last try went: confirm in the agent's window, done, or why not. */
function UndoAction({ undo }: { undo: PartUndo }) {
  const { t } = useTranslation();
  const status = undo.status;
  const waiting = status?.state === "confirm";
  return (
    <div className="flex flex-col gap-1">
      <button type="button" className={actionClass} disabled={waiting || undo.disabled} onClick={undo.onUndo}>
        {t("card.undo")}
      </button>
      {status && (
        <p role="status" className={`text-xs leading-snug ${status.state === "failed" ? "text-[#e3b341]" : status.state === "done" ? "text-[#8fd19e]" : "text-[#79c0ff]"}`}>
          {status.state === "confirm" ? t("card.undoConfirm") : status.state === "done" ? t("card.undoDone") : t(status.reason)}
        </p>
      )}
    </div>
  );
}

/**
 * The part's card next to its node (it follows the node as the graph moves): states, the agent's latest
 * insight, asking the agent about it, its changes, the parts it is linked with, and "More".
 */
export function PartCallout({
  state,
  nodeId,
  api,
  onMore,
  undo,
  ...actions
}: PartActions & { state: CanvasState; nodeId: string; api: GraphApi | null; onMore: () => void; undo?: PartUndo }) {
  const { t } = useTranslation();
  const boxRef = useRef<HTMLDivElement>(null);
  const node = canvasNodes(state).find((n) => n.id === nodeId);

  // Follow the node every frame: the graph moves under the card.
  useEffect(() => {
    let raf = 0;
    const follow = () => {
      const at = api?.screenOf(nodeId);
      const el = boxRef.current;
      const room = el?.parentElement;
      if (at && el && room) {
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        // Right of the node; left when there is no room; inside the canvas.
        let x = at.x + at.r + 22;
        if (x + w > room.clientWidth - 12) x = at.x - at.r - 22 - w;
        const y = Math.min(Math.max(at.y - h / 2, 70), Math.max(70, room.clientHeight - h - 12));
        el.style.transform = `translate(${Math.round(Math.max(12, x))}px, ${Math.round(y)}px)`;
        el.style.opacity = "1";
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [api, nodeId]);

  if (!node) return null;
  const insight = node.insights[node.insights.length - 1];
  const changes = changesOf(state, node.id);
  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label={node.label}
      data-testid="part-callout"
      className="absolute left-0 top-0 z-20 flex w-[300px] flex-col gap-2 rounded-xl border border-[#30363d] bg-[rgba(22,27,34,0.97)] p-3 opacity-0 shadow-2xl transition-opacity"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-bold text-[#f4f5f8]">{node.label}</div>
          {node.summary && <div className="mt-0.5 text-[12.5px] leading-snug text-[#c9d1d9]">{node.summary}</div>}
        </div>
        <button
          type="button"
          onClick={actions.onClose}
          aria-label={t("card.close")}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#30363d] bg-[#1b1f28] text-[#8b93a7]"
        >
          ×
        </button>
      </div>
      <Badges node={node} />
      {insight && <div className="text-xs leading-snug text-[#e3c77a]">💡 {insight}</div>}
      <div className="flex flex-col gap-1">
        <button type="button" className={actionClass} onClick={() => actions.onAsk(t("card.askPrefix", { label: node.label }))}>
          {t("card.askAgent")}
        </button>
        <ExplainAction nodeId={node.id} actions={actions} />
        {changes && (
          <button type="button" className={actionClass} onClick={() => changes.files[0] && actions.onShowChanges(changes.files[0])}>
            {t("card.showChanges")}
          </button>
        )}
        {undo && <UndoAction undo={undo} />}
      </div>
      <Related state={state} node={node} onGoTo={actions.onGoTo} />
      <button type="button" onClick={onMore} className="self-start px-0.5 py-1 text-xs text-[#79c0ff] hover:underline">
        {t("card.more")} →
      </button>
    </div>
  );
}

const HISTORY_COLOR: Record<PartEvent["kind"], string> = {
  found: "text-[#8b93a7]",
  link: "text-[#8b93a7]",
  insight: "text-[#e3b341]",
  think: "text-[#79c0ff]",
  change: "text-[#f2cc60]",
  failed: "text-[#ff7b72]",
};

const captionClass = "flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#8b93a7]";

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className={captionClass}>
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function LinkGroup({ title, parts, onGoTo }: { title: string; parts: CanvasNodeView[]; onGoTo: (id: string) => void }) {
  if (parts.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-[#6e7681]">{title}</span>
      <div className="flex flex-wrap gap-1">
        {parts.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => onGoTo(n.id)}
            className="rounded-full border border-[#30363d] bg-[#14161d] px-2 py-0.5 text-[11.5px] text-[#c9d1d9] hover:border-[#58a6ff]"
          >
            {n.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Everything about the part, in a card at the right edge: what the agent understood, the parts it is linked with
 * by how, what happened to it in the session, its changes; its files for developers open in the code viewer.
 */
export function PartPanel({
  state,
  nodeId,
  records = [],
  undo,
  ...actions
}: PartActions & { state: CanvasState; nodeId: string; records?: CanvasRecord[]; undo?: PartUndo }) {
  const { t, locale } = useTranslation();
  const node = canvasNodes(state).find((n) => n.id === nodeId);
  if (!node) return null;
  const changes = changesOf(state, node.id);
  const rel = relatedGroups(state, node.id);
  const history = partHistory(records, node.id, t, (id) => state.nodes[id]?.label ?? id);
  const clock = (at: number) => new Date(at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return (
    <aside
      aria-label={node.label}
      data-testid="part-panel"
      className="absolute right-6 top-1/2 z-20 flex max-h-[76vh] w-[340px] -translate-y-1/2 flex-col rounded-[14px] border border-[#30363d] bg-[rgba(22,27,34,0.98)] shadow-[0_20px_60px_rgba(0,0,0,0.5)] max-sm:inset-x-3 max-sm:w-auto"
    >
      <div className="flex items-start gap-2.5 border-b border-[#262b36] px-3.5 pb-2.5 pt-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-[#f4f5f8]">{node.label}</h2>
          {node.summary && <p className="mt-0.5 text-[13px] leading-snug text-[#c9d1d9]">{node.summary}</p>}
        </div>
        <button
          type="button"
          onClick={actions.onClose}
          aria-label={t("card.close")}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#30363d] bg-[#1b1f28] text-[#8b93a7] hover:text-[#f4f5f8]"
        >
          <IconClose className="size-[15px]" />
        </button>
      </div>
      <div className="flex flex-col gap-3.5 overflow-y-auto p-3.5">
        <Badges node={node} />
        {node.insights.length > 0 && (
          <Section icon={<IconLightbulb className="size-[13px]" />} title={t("card.understood")}>
            {node.insights.map((i) => (
              <p key={i} className="text-[12.5px] leading-snug text-[#e3c77a]">
                {i}
              </p>
            ))}
          </Section>
        )}
        <div className="flex flex-col gap-1">
          <button type="button" className={actionClass} onClick={() => actions.onAsk(t("card.askPrefix", { label: node.label }))}>
            {t("card.askAgent")}
          </button>
          <ExplainAction nodeId={node.id} actions={actions} />
          {undo && <UndoAction undo={undo} />}
        </div>
        {changes && (
          <Section icon={<IconFile className="size-[13px]" />} title={t("card.showChanges")}>
            {changes.files.map((f) => (
              <button key={f.path} type="button" className={actionClass} onClick={() => actions.onShowChanges(f)}>
                {f.note ?? f.path}
              </button>
            ))}
          </Section>
        )}
        {(rel.parent || rel.children.length > 0 || rel.linked.length > 0) && (
          <Section icon={<IconNetwork className="size-[13px]" />} title={t("card.relatedTo")}>
            <LinkGroup title={t("card.belongsTo")} parts={rel.parent ? [rel.parent] : []} onGoTo={actions.onGoTo} />
            <LinkGroup title={t("card.inside")} parts={rel.children} onGoTo={actions.onGoTo} />
            <LinkGroup title={t("card.agentLinked")} parts={rel.linked} onGoTo={actions.onGoTo} />
          </Section>
        )}
        {history.length > 0 && (
          <Section icon={<IconActivity className="size-[13px]" />} title={t("card.history")}>
            <ol className="flex flex-col gap-1" data-testid="part-history">
              {history.map((h, i) => (
                <li key={i} className={`flex gap-2 text-xs leading-snug ${HISTORY_COLOR[h.kind]}`}>
                  <span className="shrink-0 tabular-nums text-[#6e7681]">{clock(h.at)}</span>
                  <span>{h.text}</span>
                </li>
              ))}
            </ol>
          </Section>
        )}
        <details className="group text-[12.5px] text-[#c9d1d9]">
          <summary className={`${captionClass} cursor-pointer select-none list-none`}>
            <IconCode className="size-[13px]" />
            {t("card.forDevelopers")}
            <IconChevronDown className="ml-auto size-[13px] transition-transform group-open:rotate-180" />
          </summary>
          {node.files.length === 0 ? (
            <p className="mt-2 text-[#6e7681]">{t("card.noFiles")}</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 font-mono text-[11.5px]">
              {node.files.map((f) => (
                <li key={f}>
                  <button type="button" className="rounded-md bg-[#0d1117] px-1.5 py-0.5 text-left text-[#79c0ff] hover:underline" onClick={() => actions.onOpenFile(f)}>
                    {f}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </details>
      </div>
    </aside>
  );
}
