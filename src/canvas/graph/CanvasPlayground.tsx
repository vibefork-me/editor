import { useEffect, useMemo, useRef, useState } from "react";
import { buildCanvasState } from "../canvasState.ts";
import { GraphCanvas } from "./GraphCanvas.tsx";
import type { StableGraph } from "./stableGraph.ts";
import { syntheticAnalysis } from "./syntheticSession.ts";

declare global {
  interface Window {
    /** The developer canvas, for headless checks. */
    __vfCanvas?: { stable: StableGraph; played: () => boolean; size: number; toScreen: (x: number, y: number) => { x: number; y: number } };
  }
}

/**
 * Developer view (`/dev/canvas?size=259&speed=4&seed=1`): plays a made-up analysis of `size` parts on the
 * canvas, `speed` times faster than recorded. Exists in development builds only.
 */
export default function CanvasPlayground() {
  const params = new URLSearchParams(window.location.search);
  const size = Number(params.get("size") ?? 26);
  const speed = Number(params.get("speed") ?? 4);
  const seed = Number(params.get("seed") ?? 1);
  const records = useMemo(() => syntheticAnalysis(size, seed), [size, seed]);
  const startedAt = useRef(performance.now());
  const end = records[records.length - 1]?.at ?? 0;
  const streamNow = () => Math.min(end, (performance.now() - startedAt.current) * speed);
  const [now, setNow] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const t = streamNow();
      setNow(t);
      if (t >= end) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
    // Played once per mount.
  }, []);

  const state = useMemo(() => buildCanvasState(records, now), [records, now]);
  return (
    <div className="flex h-screen flex-col bg-surface text-text">
      <div className="px-3 py-1 text-xs text-neutral-400">
        {size} parts · {Object.keys(state.nodes).length} shown · {Math.round(now / 1000)} / {Math.round(end / 1000)} s
      </div>
      <div className="min-h-0 flex-1">
        <GraphCanvas
          state={state}
          selectedId={selected}
          onSelect={setSelected}
          clock={streamNow}
          onGraph={(graph, stable) => {
            window.__vfCanvas = { stable, played: () => streamNow() >= end, size, toScreen: (x, y) => graph.graph2ScreenCoords(x, y) };
          }}
        />
      </div>
    </div>
  );
}
