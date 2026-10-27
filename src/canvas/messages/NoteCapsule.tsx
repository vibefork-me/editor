import { useEffect, useRef } from "react";
import { useTranslation } from "../../i18n/i18nStore.ts";
import type { GraphApi } from "../graph/GraphCanvas.tsx";

/**
 * A message waiting for the agent: a capsule at the node where the agent is now (it follows the node as the
 * graph moves). Gone once the agent has taken the message.
 */
export function NoteCapsule({ api, nodeId, count }: { api: GraphApi | null; nodeId: string | null; count: number }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!nodeId || count === 0) return;
    let raf = 0;
    const follow = () => {
      const at = api?.screenOf(nodeId);
      const el = ref.current;
      if (el) {
        if (at) {
          el.style.transform = `translate(${Math.round(at.x + at.r * 0.7)}px, ${Math.round(at.y - at.r - 22)}px)`;
          el.style.opacity = "1";
        } else {
          el.style.opacity = "0";
        }
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [api, nodeId, count]);

  if (!nodeId || count === 0) return null;
  return (
    <div
      ref={ref}
      role="status"
      aria-label={t("messages.capsule")}
      title={t("messages.capsule")}
      data-testid="note-capsule"
      className="pointer-events-none absolute left-0 top-0 z-10 flex h-5 items-center gap-1 rounded-full border border-[#58a6ff] bg-[#0d2847] px-2 text-[11px] font-semibold text-[#79c0ff] opacity-0 shadow-lg motion-safe:animate-pulse"
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="m2.5 4.5 5.5 4 5.5-4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      {count > 1 ? count : null}
    </div>
  );
}
