import { useEffect, useRef } from "react";
import type { ArtifactFile } from "../../client/protocol.generated.ts";
import { useTranslation } from "../../i18n/i18nStore.ts";
import { canvasNodes, type CanvasNodeView, type CanvasState } from "../canvasState.ts";
import type { GraphApi } from "../graph/GraphCanvas.tsx";
import { changesOf, partBadges, relatedParts, type Badge } from "./partInfo.ts";

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
  /** Opens a changed file's diff. */
  onShowChanges: (file: ArtifactFile) => void;
  /** Opens a file in the code viewer. */
  onOpenFile: (path: string) => void;
  /** Selects another part. */
  onGoTo: (id: string) => void;
  onClose: () => void;
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
  "flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#1b1f28] px-2.5 py-1.5 text-left text-[12.5px] text-[#e6edf3] hover:border-[#58a6ff]";

/**
 * The part's card next to its node (it follows the node as the graph moves): states, the agent's latest
 * insight, asking the agent about it, its changes, the parts it is linked with, and "More".
 */
export function PartCallout({
  state,
  nodeId,
  api,
  onMore,
  ...actions
}: PartActions & { state: CanvasState; nodeId: string; api: GraphApi | null; onMore: () => void }) {
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
        {changes && (
          <button type="button" className={actionClass} onClick={() => changes.files[0] && actions.onShowChanges(changes.files[0])}>
            {t("card.showChanges")}
          </button>
        )}
      </div>
      <Related state={state} node={node} onGoTo={actions.onGoTo} />
      <button type="button" onClick={onMore} className="self-start px-0.5 py-1 text-xs text-[#79c0ff] hover:underline">
        {t("card.more")} →
      </button>
    </div>
  );
}

/** Everything about the part, in a panel on the right; its files for developers open in the code viewer. */
export function PartPanel({ state, nodeId, ...actions }: PartActions & { state: CanvasState; nodeId: string }) {
  const { t } = useTranslation();
  const node = canvasNodes(state).find((n) => n.id === nodeId);
  if (!node) return null;
  const changes = changesOf(state, node.id);
  return (
    <aside
      aria-label={node.label}
      data-testid="part-panel"
      className="absolute bottom-4 right-4 top-20 z-20 flex w-[340px] flex-col gap-3 overflow-y-auto rounded-xl border border-[#30363d] bg-[rgba(22,27,34,0.98)] p-4 shadow-2xl"
    >
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 text-base font-bold text-[#f4f5f8]">{node.label}</h2>
        <button
          type="button"
          onClick={actions.onClose}
          aria-label={t("card.close")}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#30363d] bg-[#1b1f28] text-[#8b93a7]"
        >
          ×
        </button>
      </div>
      {node.summary && <p className="text-[13px] leading-snug text-[#c9d1d9]">{node.summary}</p>}
      <Badges node={node} />
      {node.insights.length > 0 && (
        <section>
          <div className="mb-1 text-[10.5px] uppercase tracking-wide text-[#8b93a7]">{t("card.understood")}</div>
          <ul className="flex flex-col gap-1 text-[12.5px] text-[#e3c77a]">
            {node.insights.map((i) => (
              <li key={i}>💡 {i}</li>
            ))}
          </ul>
        </section>
      )}
      <button type="button" className={actionClass} onClick={() => actions.onAsk(t("card.askPrefix", { label: node.label }))}>
        {t("card.askAgent")}
      </button>
      {changes && (
        <section className="flex flex-col gap-1">
          <div className="text-[10.5px] uppercase tracking-wide text-[#8b93a7]">{t("card.showChanges")}</div>
          {changes.files.map((f) => (
            <button key={f.path} type="button" className={actionClass} onClick={() => actions.onShowChanges(f)}>
              {f.note ?? f.path}
            </button>
          ))}
        </section>
      )}
      <Related state={state} node={node} onGoTo={actions.onGoTo} />
      <details className="text-[12.5px] text-[#c9d1d9]">
        <summary className="cursor-pointer select-none text-[#8b93a7]">{t("card.forDevelopers")}</summary>
        <div className="mt-2 text-[10.5px] uppercase tracking-wide text-[#8b93a7]">{t("card.files")}</div>
        {node.files.length === 0 ? (
          <p className="text-[#6e7681]">{t("card.noFiles")}</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-0.5 font-mono text-xs">
            {node.files.map((f) => (
              <li key={f}>
                <button type="button" className="text-left text-[#79c0ff] hover:underline" onClick={() => actions.onOpenFile(f)}>
                  {f}
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>
    </aside>
  );
}
