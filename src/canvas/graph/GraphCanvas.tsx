import ForceGraph from "force-graph";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../../i18n/i18nStore.ts";
import type { CanvasState } from "../canvasState.ts";
import { drawData, MORE, type DrawLink, type DrawNode } from "./drawData.ts";
import { BACKGROUND, nodeRadius, paintCallout, paintHoverTip, paintLabels, paintNode, type PaintText } from "./paint.ts";
import { StableGraph, calmForce, forceStrengths, linkPresence, relaxForce, ringForce } from "./stableGraph.ts";

type Graph = ForceGraph<DrawNode, DrawLink>;

export interface GraphCanvasProps {
  state: CanvasState;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Stream time now, Unix ms (a replay passes its own clock). */
  clock?: () => number;
  /** Gives the graph to headless checks and the developer view. */
  onGraph?: (graph: Graph, stable: StableGraph) => void;
}

// New nodes are handed to the layout at most this often: every hand-over restarts it at full strength.
const APPLY_MS = 450;
// After this long without new nodes the graph tidies itself into a layout without crossings.
const QUIET_MS = 1500;
const DOUBLE_CLICK_MS = 350;
// After the person moves the camera, automatic fitting leaves it alone for this long.
const MANUAL_CAMERA_MS = 20000;
// Fitting a small graph never zooms in further than this.
const MAX_FIT_ZOOM = 1.5;

/**
 * The project as a living map: parts appear next to their parents, the tree is laid out on rings and tidied
 * without crossings in pauses, roots stay put (another version of the project to the right), big branches
 * the agent has not been in fold into "+N". The camera keeps the whole graph in view and yields to the person.
 */
export function GraphCanvas({ state, selectedId = null, onSelect, clock = Date.now, onGraph }: GraphCanvasProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const stableRef = useRef(new StableGraph());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const data = useMemo(() => drawData(state, expanded), [state, expanded]);

  // The graph is set up once; its painters read the current values through refs.
  const live = useRef({ state, selectedId, onSelect, clock, hover: null as string | null, manualUntil: 0 });
  live.current = { ...live.current, state, selectedId, onSelect, clock };
  const text = useRef<PaintText>({ agentHere: "", badges: () => [] });
  text.current = {
    agentHere: t("canvas.agentHere"),
    badges: (n) =>
      [
        n.isFocused && t("canvas.badgeAgentHere"),
        n.isThinking && t("canvas.badgeThinking"),
        n.progress !== null && t("canvas.badgeWorking"),
        n.isFailed && t("canvas.badgeFailed"),
        n.isChanged && t("canvas.badgeChanged"),
        n.isTaskNode && t("canvas.badgeTask"),
        n.kind === "project" && n.parent && t("canvas.badgeOtherVersion"),
      ].filter((b): b is string => typeof b === "string"),
  };
  const fitRef = useRef(() => {});
  const timers = useRef<{ apply?: ReturnType<typeof setTimeout>; relax?: ReturnType<typeof setTimeout> }>({});

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const stable = new StableGraph();
    stableRef.current = stable;
    let lastClick: { id: string; at: number } | null = null;
    const presence = (l: DrawLink) => linkPresence(l, live.current.clock(), [live.current.hover, live.current.selectedId]);
    const touchAge = (at: number) => (at > 0 ? (live.current.clock() - at) / 1000 : -1);

    const graph: Graph = new ForceGraph<DrawNode, DrawLink>(el)
      .backgroundColor(BACKGROUND)
      .nodeId("id")
      .nodeVal((n) => nodeRadius(n))
      .nodeRelSize(1)
      .d3AlphaDecay(0.02)
      .d3VelocityDecay(0.35)
      .cooldownTicks(600)
      .autoPauseRedraw(false)
      .onNodeClick((node) => {
        const now = performance.now();
        const last = lastClick;
        lastClick = { id: node.id, at: now };
        if (node.kind === "more") {
          const parent = node.id.slice(0, -MORE.length);
          setExpanded((e) => new Set([...e, parent]));
          return;
        }
        // Double click: glide the camera to the node, zooming in only if it is small on screen.
        if (last && last.id === node.id && now - last.at < DOUBLE_CLICK_MS) {
          live.current.manualUntil = now + MANUAL_CAMERA_MS;
          graph.centerAt(node.x, node.y, 800);
          if (graph.zoom() < 1.6) graph.zoom(1.6, 800);
          return;
        }
        live.current.onSelect?.(node.id);
      })
      .onBackgroundClick(() => live.current.onSelect?.(null))
      .onNodeHover((node) => {
        live.current.hover = node ? node.id : null;
      })
      .onEngineStop(() => fitRef.current())
      .linkVisibility((l) => presence(l) > 0)
      .linkWidth((l) => {
        if (!l.hierarchy) return 1.2 + 1.8 * presence(l);
        const age = touchAge(l.lastTouchAt);
        if (age >= 0 && age < 3) return 1.8 + Math.min(l.touchCount, 6) * 1.5 * (1 - age / 3);
        return l.touchCount > 0 ? 1.8 : 1.0;
      })
      .linkColor((l) => {
        if (!l.hierarchy) return `rgba(121, 192, 255, ${0.85 * presence(l)})`;
        const age = touchAge(l.lastTouchAt);
        if (age >= 0 && age < 3) return `rgba(88, 166, 255, ${0.35 + 0.65 * (1 - age / 3)})`;
        return l.touchCount > 0 ? "rgba(100, 130, 180, 0.45)" : "rgba(50, 60, 80, 0.4)";
      })
      .nodeCanvasObject((node, ctx, scale) => {
        const { state: s, selectedId: sel } = live.current;
        paintNode(ctx, node, scale, Date.now(), touchAge(node.lastTouchAt), node.id === s.focusedId, node.id === sel);
      })
      .onRenderFramePost((ctx, scale) => {
        const { state: s, selectedId: sel, hover } = live.current;
        const nodes = [...stable.nodes.values()];
        paintLabels(ctx, scale, nodes, s.focusedId, sel, text.current);
        const insight = s.latestInsight;
        if (insight) paintCallout(ctx, scale, stable.nodes.get(insight.nodeId), insight.text, (live.current.clock() - insight.at) / 1000);
        if (hover && hover !== sel) paintHoverTip(ctx, scale, stable.nodes.get(hover), text.current);
      });

    // Only the tree shapes the layout; roots are pinned, so the library's centering is off.
    graph.d3Force("charge")?.strength(forceStrengths(false).charge);
    graph.d3Force("link")?.distance(85).strength(forceStrengths(false).link);
    graph.d3Force("center", null);
    graph.d3Force("rings", ringForce(stable));
    graph.d3Force("relax", relaxForce(stable));
    graph.d3Force("calm", calmForce(stable));
    graphRef.current = graph;

    fitRef.current = () => {
      if (performance.now() < live.current.manualUntil) return;
      const nodes = graph.graphData().nodes;
      if (!nodes.some((n) => typeof n.x === "number")) return;
      graph.zoomToFit(900, 100);
      // A few parts must not fill the screen.
      setTimeout(() => graph.zoom() > MAX_FIT_ZOOM && graph.zoom(MAX_FIT_ZOOM, 400), 950);
    };
    onGraph?.(graph, stable);

    // The person zooms or drags the view: automatic fitting leaves the camera alone for a while.
    const manual = () => (live.current.manualUntil = performance.now() + MANUAL_CAMERA_MS);
    const drag = (e: PointerEvent) => e.buttons !== 0 && manual();
    el.addEventListener("wheel", manual, { passive: true });
    el.addEventListener("pointermove", drag);
    const resize = () => graph.width(el.clientWidth).height(el.clientHeight);
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    return () => {
      observer.disconnect();
      el.removeEventListener("wheel", manual);
      el.removeEventListener("pointermove", drag);
      clearTimeout(timers.current.apply);
      clearTimeout(timers.current.relax);
      timers.current = {};
      graph._destructor();
      graphRef.current = null;
    };
    // The graph lives as long as the component.
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    const stable = stableRef.current;
    if (!graph || !stable.sync(data)) return;
    const strengths = forceStrengths(false);
    graph.d3Force("charge")?.strength(strengths.charge);
    graph.d3Force("link")?.strength(strengths.link);
    if (timers.current.apply) return;
    timers.current.apply = setTimeout(() => {
      timers.current.apply = undefined;
      graph.graphData(stable.data());
      fitRef.current();
      // Nothing new for a moment: tidy up into a layout without crossings.
      clearTimeout(timers.current.relax);
      timers.current.relax = setTimeout(() => {
        stable.startRelax();
        const relaxed = forceStrengths(true);
        graph.d3Force("charge")?.strength(relaxed.charge);
        graph.d3Force("link")?.strength(relaxed.link);
        graph.d3ReheatSimulation();
        for (const ms of [1200, 3500, 7000]) setTimeout(() => stable.targets && fitRef.current(), ms);
      }, QUIET_MS);
    }, APPLY_MS);
  }, [data]);

  // A finished task: the camera shows the changed parts and stays there.
  const finished = state.result !== null;
  useEffect(() => {
    const graph = graphRef.current;
    if (!finished || !graph) return;
    const touched = (n: DrawNode) => n.isChanged || n.isTaskNode;
    if (![...stableRef.current.nodes.values()].some(touched)) return;
    live.current.manualUntil = performance.now() + MANUAL_CAMERA_MS;
    graph.zoomToFit(1200, 140, touched);
  }, [finished]);

  return <div ref={containerRef} className="h-full w-full" data-testid="graph-canvas" />;
}

