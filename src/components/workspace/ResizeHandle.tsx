import { useRef } from "react";
import { PANEL_LIMITS, useLayoutStore, type PanelId } from "../../stores/layoutStore.ts";

const KEY_STEP = 24;

/**
 * The border of a panel the person drags to resize it (arrow keys work too). `edge` is the side of the panel
 * the border is on: dragging away from the panel makes it bigger.
 */
export function ResizeHandle({ panel, edge, label }: { panel: PanelId; edge: "left" | "right" | "top"; label: string }) {
  const size = useLayoutStore((s) => s.panels[panel].size);
  const setSize = useLayoutStore((s) => s.setSize);
  const drag = useRef<{ start: number; size: number } | null>(null);
  const vertical = edge !== "top";
  // Moving the pointer right grows a panel whose border is on its right.
  const sign = edge === "right" ? 1 : -1;
  const { min, max } = PANEL_LIMITS[panel];

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-valuenow={size}
      aria-valuemin={min}
      aria-valuemax={max}
      data-testid={`resize-${panel}`}
      className={`group relative z-20 shrink-0 bg-border outline-none focus-visible:bg-accent ${
        vertical ? "w-px cursor-col-resize" : "h-px cursor-row-resize"
      }`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        drag.current = { start: vertical ? e.clientX : e.clientY, size };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const pos = vertical ? e.clientX : e.clientY;
        setSize(panel, d.size + sign * (pos - d.start));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={(e) => {
        const grow = vertical ? (e.key === "ArrowRight" ? sign : e.key === "ArrowLeft" ? -sign : 0) : e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
        if (!grow) return;
        e.preventDefault();
        setSize(panel, size + grow * KEY_STEP);
      }}
    >
      {/* A wider area to grab than the 1px line. */}
      <span className={`absolute group-hover:bg-accent/40 ${vertical ? "inset-y-0 -left-1 -right-1" : "inset-x-0 -top-1 -bottom-1"}`} />
    </div>
  );
}
