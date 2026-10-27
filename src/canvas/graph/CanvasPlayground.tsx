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

/** What the rings and colors on a node mean (developer view only). */
const LEGEND: [string, string][] = [
  ["#388bfd", "project (root)"],
  ["#1f9d8a", "another version of the project (diamond, to the right)"],
  ["#30363d", "part"],
  ["#238636", "smaller piece inside a part"],
  ["#8a63d2", "part of the task (violet rings +4/+6.5)"],
  ["#b08800", "changed by the task (amber dashed ring +9.5, pencil)"],
  ["#f85149", "a check failed here (red ring +9.5, !)"],
  ["#58a6ff", "work in progress (loader ring +13, %)"],
  ["#79c0ff", "the agent is here (dotted ring +17); thinking — breathing glow"],
  ["#6e7681", "+N — folded branch the agent has not been in; click to open"],
];

function Legend() {
  return (
    <ul className="pointer-events-none absolute right-3 top-3 z-10 space-y-1 rounded-md bg-black/60 p-2 text-[11px] text-neutral-300">
      {LEGEND.map(([color, text]) => (
        <li key={text} className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          {text}
        </li>
      ))}
    </ul>
  );
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
  // The clock keeps going after the end, so flashes fade; the state stops at the last event.
  const clock = () => (performance.now() - startedAt.current) * speed;
  const streamNow = () => Math.min(end, clock());
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
      <div className="relative min-h-0 flex-1">
        <Legend />
        <GraphCanvas
          state={state}
          selectedId={selected}
          onSelect={setSelected}
          clock={clock}
          onGraph={(graph, stable) => {
            window.__vfCanvas = { stable, played: () => streamNow() >= end, size, toScreen: (x, y) => graph.graph2ScreenCoords(x, y) };
          }}
        />
      </div>
    </div>
  );
}
