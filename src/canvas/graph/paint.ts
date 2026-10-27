import type { DrawNode } from "./drawData.ts";

// Drawing of the 2D canvas: node bodies and their rings, labels, the insight callout and the hover tip.
// Rings sit at fixed distances from the body so they never cover each other:
// selected +2, task +4/+6.5, changed or failed +9.5, loader +13, agent here +17.

export const BACKGROUND = "#14161d";
const FONT = '"IBM Plex Sans", system-ui, sans-serif';

export function nodeRadius(n: Pick<DrawNode, "kind">): number {
  return n.kind === "project" ? 18 : n.kind === "subsystem" ? 8 : n.kind === "more" ? 9 : 12;
}

/** Distance from the body to the outermost ring a node shows, so labels go outside it. */
export function ringsOf(n: DrawNode, focusId: string | null): number {
  if (n.id === focusId) return 17;
  if (n.progress !== null) return 13;
  if (n.isChanged || n.isFailed) return 9.5;
  if (n.isTaskNode) return 6.5;
  return 0;
}

/** Strings the canvas shows, in the interface language. */
export interface PaintText {
  agentHere: string;
  /** Short states of a part for the hover tip. */
  badges: (n: DrawNode) => string[];
}

/** One node with its rings. `now` — wall clock, ms; `touchAge` — seconds since the agent last moved through it. */
export function paintNode(
  ctx: CanvasRenderingContext2D,
  n: DrawNode,
  scale: number,
  now: number,
  touchAge: number,
  focused: boolean,
  selected: boolean,
): void {
  const x = n.x ?? 0;
  const y = n.y ?? 0;
  const radius = nodeRadius(n);
  const touch = touchAge >= 0 && touchAge < 3 ? 1 - touchAge / 3 : 0;

  // Glows go underneath everything else.
  if (focused || touch > 0) {
    const pulse = (Math.sin(now / 200) + 1) / 2;
    ctx.beginPath();
    ctx.arc(x, y, radius + 17, 0, 2 * Math.PI);
    ctx.fillStyle = focused ? `rgba(88, 166, 255, ${0.1 + 0.08 * pulse})` : `rgba(63, 185, 80, ${0.16 * touch})`;
    ctx.fill();
  }
  // Thinking: a slow breathing glow while the agent waits for the AI.
  if (n.isThinking) {
    const breath = (Math.sin(now / 700) + 1) / 2;
    ctx.beginPath();
    ctx.arc(x, y, radius + 17 + breath * 6, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(121, 192, 255, ${0.08 + 0.12 * (1 - breath)})`;
    ctx.fill();
  }

  if (n.kind === "more") {
    // The count stays readable when zoomed out.
    const fs = Math.max(7, 9.5 / scale);
    const rr = Math.max(9, fs * 1.25);
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, 2 * Math.PI);
    ctx.fillStyle = "#1b1f28";
    ctx.fill();
    ctx.setLineDash([2.5, 2]);
    ctx.strokeStyle = "#6e7681";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#c9d1d9";
    ctx.font = `600 ${fs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(n.label, x, y + 0.5);
    return;
  }

  if (n.isTaskNode) {
    ctx.strokeStyle = "#bc8cff";
    for (const [gap, width] of [
      [4, 1.6],
      [6.5, 1.2],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, radius + gap, 0, 2 * Math.PI);
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  // A check broke here: a red ring with "!", until the agent changes this part.
  if (n.isFailed) {
    const flash = (Math.sin(now / 160) + 1) / 2;
    ctx.beginPath();
    ctx.arc(x, y, radius + 9.5, 0, 2 * Math.PI);
    ctx.strokeStyle = `rgba(248, 81, 73, ${0.6 + 0.4 * flash})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + radius * 0.8, y - radius * 0.8, 5.5, 0, 2 * Math.PI);
    ctx.fillStyle = "#f85149";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold 8px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", x + radius * 0.8, y - radius * 0.8 + 0.5);
  } else if (n.isChanged) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 9.5, 0, 2 * Math.PI);
    ctx.strokeStyle = "#e3b341";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Work on this part: a loader ring; a spinner when the amount is unknown.
  if (n.progress !== null) {
    const rr = radius + 13;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(88, 166, 255, 0.18)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    if (n.progress < 0) {
      const a = (now / 220) % (2 * Math.PI);
      ctx.arc(x, y, rr, a, a + Math.PI * 0.6);
    } else {
      ctx.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * Math.min(1, n.progress));
    }
    ctx.strokeStyle = "#58a6ff";
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.lineCap = "butt";
    if (n.progress >= 0) {
      const fs = Math.max(7, 9 / scale);
      ctx.font = `600 ${fs}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "#79c0ff";
      ctx.fillText(`${Math.round(n.progress * 100)}%`, x, y - rr - 2);
    }
  }

  // The agent is here: the outermost ring, dotted, pulsing in brightness, not in size.
  if (focused || touch > 0) {
    const pulse = (Math.sin(now / 200) + 1) / 2;
    ctx.beginPath();
    ctx.arc(x, y, radius + 17, 0, 2 * Math.PI);
    ctx.strokeStyle = focused ? `rgba(88, 166, 255, ${0.55 + 0.45 * pulse})` : `rgba(63, 185, 80, ${0.65 * touch})`;
    ctx.lineWidth = focused ? 2 : 1.2;
    ctx.setLineDash(focused ? [3, 3] : []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (selected) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 2, 0, 2 * Math.PI);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // The body; another version of the project is a diamond.
  ctx.beginPath();
  if (n.kind === "project" && n.parent) {
    const d = radius * 1.25;
    ctx.moveTo(x, y - d);
    ctx.lineTo(x + d, y);
    ctx.lineTo(x, y + d);
    ctx.lineTo(x - d, y);
    ctx.closePath();
  } else {
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
  }
  ctx.fillStyle =
    n.kind === "project"
      ? n.parent
        ? "#1f9d8a"
        : "#388bfd"
      : n.isChanged
        ? "#b08800"
        : n.isTaskNode
          ? "#8a63d2"
          : n.kind === "subsystem"
            ? "#238636"
            : "#30363d";
  ctx.fill();
  ctx.strokeStyle = focused ? "#79c0ff" : n.isTaskNode ? "#d2a8ff" : "#565e6d";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  if (n.isChanged && !n.isFailed) {
    ctx.fillStyle = "#fff8e1";
    ctx.font = `${Math.round(radius * 1.15)}px "Segoe UI Symbol", "DejaVu Sans", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✎", x, y + radius * 0.06);
  }
}

interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const hit = (a: Rect, b: Rect) => !(b.x1 > a.x2 || b.x2 < a.x1 || b.y1 > a.y2 || b.y2 < a.y1);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function priority(n: DrawNode, focusId: string | null, selectedId: string | null, size: number): number {
  if (n.kind === "project") return 100;
  if (n.id === focusId) return 90;
  if (n.id === selectedId) return 80;
  if (n.isChanged || n.isTaskNode || n.isFailed || n.progress !== null) return 60;
  // Shallower and bigger branches first.
  return 50 - Math.min(n.depth, 4) * 8 + Math.min(size, 30) / 3;
}

// The zoom from which a level's labels appear (they fade in over the next 25 %).
const LEVEL_FROM = [0, 0.25, 0.85, 1.4, 2.0];
// About one label per this many square pixels of screen, so the view never turns into a wall of text.
const AREA_PER_LABEL = 120 * 120;

function fade(n: DrawNode, pri: number, scale: number, small: boolean): number {
  if (pri >= 60) return 1;
  if (small) return clamp01((scale - 0.3) / 0.2);
  const from = LEVEL_FROM[Math.min(n.depth, LEVEL_FROM.length - 1)] ?? 0;
  return clamp01((scale - from) / (from * 0.25 || 0.1));
}

function labelColor(n: DrawNode, focused: boolean): string {
  if (focused) return "#ffffff";
  if (n.isChanged) return "#f2cc60";
  if (n.isTaskNode) return "#e2c5ff";
  if (n.kind === "subsystem") return "#9aa4b2";
  return "#d0d7de";
}

/**
 * Labels: every node is named at a constant on-screen size, placed by importance; each tries below, right,
 * left and above its node and is dropped only when there is no room. Zooming out fades deep levels first.
 */
export function paintLabels(
  ctx: CanvasRenderingContext2D,
  scale: number,
  nodes: DrawNode[],
  focusId: string | null,
  selectedId: string | null,
  text: PaintText,
): void {
  const placed: Rect[] = [];
  const shown = nodes.filter((n) => typeof n.x === "number" && typeof n.y === "number");
  const circles = shown.map((n) => {
    const r = nodeRadius(n) + 2 / scale;
    return { id: n.id, rect: { x1: n.x! - r, y1: n.y! - r, x2: n.x! + r, y2: n.y! + r } };
  });
  // Branch sizes: how many parts hang below each node.
  const size = new Map<string, number>();
  const parentOf = new Map(nodes.map((m) => [m.id, m.parent]));
  for (const n of shown) {
    let p = n.parent;
    while (p) {
      size.set(p, (size.get(p) ?? 0) + 1);
      p = parentOf.get(p) ?? null;
    }
  }
  const small = shown.length <= 40;
  const dpr = window.devicePixelRatio || 1;
  let budget = Math.floor(((ctx.canvas.width / dpr) * (ctx.canvas.height / dpr)) / AREA_PER_LABEL);
  const order = shown
    .filter((n) => n.kind !== "more")
    .map((n) => ({ n, pri: priority(n, focusId, selectedId, size.get(n.id) ?? 0) }))
    .sort((a, b) => b.pri - a.pri);

  ctx.save();
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  for (const { n, pri } of order) {
    const alpha = fade(n, pri, scale, small);
    if (alpha <= 0) continue;
    if (pri < 60 && !small && budget-- <= 0) continue;
    const focused = n.id === focusId;
    const px = n.kind === "project" ? 12.5 : n.kind === "subsystem" ? 10.5 : 11.5;
    const f = px / scale;
    ctx.font = `${n.kind === "project" || focused ? "600 " : ""}${f}px ${FONT}`;
    const w = ctx.measureText(n.label).width;
    const r = nodeRadius(n) + ringsOf(n, focusId);
    const gap = 4 / scale;
    const x = n.x!;
    const y = n.y!;
    const spots = [
      { x: x - w / 2, y: y + r + gap },
      { x: x + r + gap, y: y - f / 2 },
      { x: x - r - gap - w, y: y - f / 2 },
      { x: x - w / 2, y: y - r - gap - f },
    ];
    const rectOf = (s: { x: number; y: number }) => ({ x1: s.x - 2 / scale, y1: s.y - 1 / scale, x2: s.x + w + 2 / scale, y2: s.y + f + 1 / scale });
    const free = (s: { x: number; y: number }) =>
      placed.every((p) => !hit(rectOf(s), p)) && circles.every((c) => c.id === n.id || !hit(rectOf(s), c.rect));
    const spot = pri >= 80 ? spots[0] : spots.find(free);
    if (!spot) continue;
    placed.push(rectOf(spot));

    ctx.globalAlpha = alpha;
    if (focused) {
      // The agent's node: a pill, and "now here" under it.
      const pad = 5 / scale;
      ctx.fillStyle = "rgba(18, 20, 27, 0.94)";
      ctx.strokeStyle = "rgba(88, 166, 255, 0.75)";
      ctx.lineWidth = 1 / scale;
      ctx.beginPath();
      ctx.roundRect(spot.x - pad, spot.y - pad / 2, w + pad * 2, f + pad, 4 / scale);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = labelColor(n, true);
      ctx.fillText(n.label, spot.x, spot.y);
      const bf = 9.5 / scale;
      ctx.font = `${bf}px ${FONT}`;
      const bw = ctx.measureText(text.agentHere).width;
      ctx.fillStyle = "#79c0ff";
      ctx.fillText(text.agentHere, spot.x + w / 2 - bw / 2, spot.y + f + pad);
      placed.push({ x1: spot.x, y1: spot.y + f, x2: spot.x + w, y2: spot.y + f + pad + bf });
      continue;
    }
    // Plain text with a halo, so it reads over links.
    ctx.lineJoin = "round";
    ctx.lineWidth = 3 / scale;
    ctx.strokeStyle = BACKGROUND;
    ctx.strokeText(n.label, spot.x, spot.y);
    ctx.fillStyle = labelColor(n, false);
    ctx.fillText(n.label, spot.x, spot.y);
  }
  ctx.restore();
}

const CALLOUT_S = 4.5;
const CALLOUT_PX = 11.5;
const CALLOUT_MAX_W = 230;
// Line breaks are found once per text in screen pixels: re-wrapping at the camera's changing scale made
// words jump between lines.
const wrapped = new Map<string, { lines: string[]; width: number }>();

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

/** Where a node is on the screen, in CSS pixels, and the device pixel ratio. */
function screenOf(ctx: CanvasRenderingContext2D, n: DrawNode) {
  const at = ctx.getTransform().transformPoint(new DOMPoint(n.x, n.y));
  const dpr = window.devicePixelRatio || 1;
  return { sx: at.x / dpr, sy: at.y / dpr, dpr };
}

/** The agent's insight next to its part: fades in, stays a few seconds, fades out. `age` — seconds. */
export function paintCallout(ctx: CanvasRenderingContext2D, scale: number, node: DrawNode | undefined, text: string, age: number): void {
  if (!node || typeof node.x !== "number" || typeof node.y !== "number" || age < 0 || age > CALLOUT_S) return;
  const alpha = Math.min(1, age / 0.3, (CALLOUT_S - age) / 0.6);
  let layout = wrapped.get(text);
  if (!layout) {
    ctx.font = `${CALLOUT_PX}px ${FONT}`;
    const lines = wrap(ctx, text, CALLOUT_MAX_W);
    layout = { lines, width: Math.max(...lines.map((l) => ctx.measureText(l).width)) };
    wrapped.set(text, layout);
  }
  // Drawn in screen pixels at whole-pixel positions, so the lines do not jitter as the graph moves.
  const { sx, sy, dpr } = screenOf(ctx, node);
  const r = nodeRadius(node) * scale;
  const pad = 8;
  const lineH = Math.round(CALLOUT_PX * 1.35);
  const w = Math.ceil(layout.width) + pad * 2;
  const h = layout.lines.length * lineH + pad * 2;
  const x = Math.round(sx + r + 18);
  const y = Math.round(sy - r - 14 - h);
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "rgba(227, 179, 65, 0.8)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(sx + r * 0.7, sy - r * 0.7);
  ctx.lineTo(x + 10, y + h);
  ctx.stroke();
  ctx.fillStyle = "rgba(38, 32, 18, 0.96)";
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w, h, 6);
  ctx.fill();
  ctx.stroke();
  ctx.font = `${CALLOUT_PX}px ${FONT}`;
  ctx.fillStyle = "#f4e3b5";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  layout.lines.forEach((l, i) => ctx.fillText(l, x + pad, y + pad + i * lineH));
  ctx.restore();
}

/** A small tip at the hovered node: its name, one line of what it does and its states, in screen pixels. */
export function paintHoverTip(ctx: CanvasRenderingContext2D, scale: number, node: DrawNode | undefined, text: PaintText): void {
  if (!node || typeof node.x !== "number" || typeof node.y !== "number" || node.kind === "more") return;
  const { sx, sy, dpr } = screenOf(ctx, node);
  const r = nodeRadius(node) * scale;
  const pad = 8;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = `600 12.5px ${FONT}`;
  const tw = ctx.measureText(node.label).width;
  ctx.font = `11.5px ${FONT}`;
  let summary = node.summary;
  while (summary && ctx.measureText(summary).width > 260) summary = summary.slice(0, -2).trimEnd() + "…";
  const badges = text.badges(node).join(" · ");
  const w =
    Math.ceil(Math.max(tw, summary ? ctx.measureText(summary).width : 0, badges ? ctx.measureText(badges).width : 0)) + pad * 2;
  const h = pad * 2 + 16 + (summary ? 16 : 0) + (badges ? 16 : 0);
  const x = Math.round(sx - w / 2);
  const y = Math.round(sy + r + 10);
  ctx.fillStyle = "rgba(22, 27, 34, 0.97)";
  ctx.strokeStyle = "#30363d";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  let ty = y + pad;
  ctx.font = `600 12.5px ${FONT}`;
  ctx.fillStyle = "#f4f5f8";
  ctx.fillText(node.label, x + pad, ty);
  ty += 16;
  ctx.font = `11.5px ${FONT}`;
  if (summary) {
    ctx.fillStyle = "#c9d1d9";
    ctx.fillText(summary, x + pad, ty);
    ty += 16;
  }
  if (badges) {
    ctx.fillStyle = "#e3b341";
    ctx.fillText(badges, x + pad, ty);
  }
  ctx.restore();
}
