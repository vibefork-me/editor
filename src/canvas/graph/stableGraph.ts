import { linkEnd, type DrawData, type DrawLink, type DrawNode } from "./drawData.ts";

// The state is rebuilt on every event. A force layout must not get it as is: every graphData() call
// reheats the layout (it never settles and tangles). StableGraph keeps one object per node and link,
// copies each new state's values onto them, and reports whether nodes or links appeared or disappeared —
// only then does the layout need new data.

const FRESH_MS = 1200;
const MAX_SPEED = 1.5;
const MAX_SPEED_FRESH = 6;
// A settled node slows down further with age, so a big graph comes to rest instead of drifting.
const SETTLE_S = 3;
const MIN_SPEED = 0.12;
// Rings by depth around the root keep branches from growing into each other.
export const RING = 90;
const RING_STRENGTH = 0.06;
// Tidying while nothing new appears: nodes glide to a tree layout without crossings.
const RELAX_SPEED = 2.2;
const RELAX_PULL = 0.08;
// Roots never move: the project in the middle, another version of it to the right.
export const VERSION_DX = 560;
export const CHARGE = -450;
const CHARGE_RELAX = -60;
const LEAF_GAP = 34;

type Point = { x: number; y: number };
const placed = (n: DrawNode | undefined): n is DrawNode & Point => !!n && typeof n.x === "number" && typeof n.y === "number";

export class StableGraph {
  nodes = new Map<string, DrawNode>();
  links = new Map<string, DrawLink>();
  private key = "";
  /** When each node appeared (`now()`). */
  private bornAt = new Map<string, number>();
  /** Where nodes glide to while the graph is tidied; null while it grows. */
  targets: Map<string, Point> | null = null;
  relaxAt = 0;

  constructor(private now: () => number = () => performance.now(), private random: () => number = Math.random) {}

  /** Copies a state onto the kept objects; true when the set of nodes or links changed. */
  sync(data: DrawData): boolean {
    for (const n of data.nodes) {
      const own = this.nodes.get(n.id);
      if (own) {
        // Positions and velocities belong to the layout, not to the state.
        const { x, y, vx, vy, fx, fy } = own;
        Object.assign(own, n, { x, y, vx, vy, fx, fy });
        continue;
      }
      // A new node appears next to its parent, not at a random spot that shoves the graph around.
      const fresh: DrawNode = { ...n };
      const parent = n.parent ? this.nodes.get(n.parent) : undefined;
      if (placed(parent)) {
        // Outward: away from the grandparent, so the branch keeps its direction.
        const grand = parent.parent ? this.nodes.get(parent.parent) : undefined;
        const away =
          placed(grand) && (grand.x !== parent.x || grand.y !== parent.y)
            ? Math.atan2(parent.y - grand.y, parent.x - grand.x)
            : this.random() * 2 * Math.PI;
        const a = away + (this.random() - 0.5) * 1.4;
        fresh.x = parent.x + Math.cos(a) * 30;
        fresh.y = parent.y + Math.sin(a) * 30;
        fresh.vx = fresh.vy = 0;
      }
      if (n.kind === "project") {
        fresh.fx = fresh.x = n.parent ? VERSION_DX : 0;
        fresh.fy = fresh.y = 0;
      }
      this.nodes.set(n.id, fresh);
      this.bornAt.set(n.id, this.now());
    }
    for (const l of data.links) {
      const own = this.links.get(l.id);
      if (own) {
        own.touchCount = l.touchCount;
        own.lastTouchAt = l.lastTouchAt;
      } else {
        this.links.set(l.id, { ...l, source: linkEnd(l.source), target: linkEnd(l.target) });
      }
    }
    const key = data.nodes.map((n) => n.id).join(",") + "|" + data.links.map((l) => l.id).join(",");
    if (key === this.key) return false;
    this.stopRelax(); // growing again: tidying waits for the next quiet moment
    const nodeIds = new Set(data.nodes.map((n) => n.id));
    const linkIds = new Set(data.links.map((l) => l.id));
    for (const id of [...this.nodes.keys()]) if (!nodeIds.has(id)) this.nodes.delete(id);
    for (const id of [...this.links.keys()]) if (!linkIds.has(id)) this.links.delete(id);
    this.key = key;
    return true;
  }

  isFresh(id: string): boolean {
    return this.now() - (this.bornAt.get(id) ?? 0) < FRESH_MS;
  }

  /**
   * A tree layout without crossings for what is shown now: every branch gets a sector around its root in
   * proportion to its size, levels lie on rings, and branches keep their current order around the root.
   */
  startRelax(): void {
    const kids = new Map<string, (DrawNode & Point)[]>();
    for (const n of this.nodes.values()) {
      if (n.kind === "project" || !n.parent || !this.nodes.has(n.parent) || !placed(n)) continue;
      kids.set(n.parent, [...(kids.get(n.parent) ?? []), n]);
    }
    const targets = new Map<string, Point>();
    for (const root of this.nodes.values()) {
      if (root.kind === "project" && placed(root)) this.layoutTree(root, kids, targets);
    }
    this.targets = targets;
    this.relaxAt = this.now();
  }

  private layoutTree(root: DrawNode & Point, kids: Map<string, (DrawNode & Point)[]>, targets: Map<string, Point>) {
    const weight = new Map<string, number>();
    const depthCount: number[] = [];
    const visit = (id: string, depth: number): number => {
      const cs = kids.get(id) ?? [];
      depthCount[depth] = (depthCount[depth] ?? 0) + 1;
      const w = cs.length ? cs.reduce((acc, c) => acc + visit(c.id, depth + 1), 0) : 1;
      weight.set(id, w);
      return w;
    };
    visit(root.id, 0);
    // Each ring is big enough for its nodes to stand LEAF_GAP apart.
    const radius: number[] = [0];
    for (let d = 1; d < depthCount.length; d++) {
      radius[d] = Math.max((radius[d - 1] ?? 0) + RING + 20, ((depthCount[d] ?? 0) * LEAF_GAP) / (2 * Math.PI));
    }
    const angleOf = (n: Point) => Math.atan2(n.y - root.y, n.x - root.x);
    const place = (id: string, from: number, to: number, depth: number) => {
      const cs = [...(kids.get(id) ?? [])];
      if (!cs.length) return;
      // Keep the current order around the root, starting from this sector's edge.
      const norm = (a: number) => (((a - from) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      cs.sort((a, b) => norm(angleOf(a)) - norm(angleOf(b)));
      const total = weight.get(id) ?? cs.length;
      const r = radius[depth + 1] ?? 0;
      let a = from;
      for (const c of cs) {
        const span = ((to - from) * (weight.get(c.id) ?? 1)) / total;
        const mid = a + span / 2;
        targets.set(c.id, { x: root.x + Math.cos(mid) * r, y: root.y + Math.sin(mid) * r });
        place(c.id, a, a + span, depth + 1);
        a += span;
      }
    };
    const first = (kids.get(root.id) ?? [])[0];
    const start = first ? angleOf(first) - 0.3 : 0;
    place(root.id, start, start + 2 * Math.PI, 0);
  }

  /** Back to growing. */
  stopRelax(): void {
    this.targets = null;
  }

  /** Speed limit for a node: fast while new, then slower and slower; steady while the graph is tidied. */
  maxSpeed(id: string): number {
    if (this.targets) return RELAX_SPEED;
    const age = (this.now() - (this.bornAt.get(id) ?? 0)) / 1000;
    if (age * 1000 < FRESH_MS) return MAX_SPEED_FRESH;
    return Math.max(MIN_SPEED, MAX_SPEED * Math.exp(-(age - FRESH_MS / 1000) / SETTLE_S));
  }

  data(): { nodes: DrawNode[]; links: DrawLink[] } {
    return { nodes: [...this.nodes.values()], links: [...this.links.values()] };
  }
}

/** A d3 force: called every tick; `initialize` gets the simulation's nodes. */
type Force = ((alpha: number) => void) & { initialize: (nodes: DrawNode[]) => void };

function force(apply: (nodes: DrawNode[], alpha: number) => void): Force {
  let nodes: DrawNode[] = [];
  const f = ((alpha: number) => apply(nodes, alpha)) as Force;
  f.initialize = (ns) => {
    nodes = ns;
  };
  return f;
}

/**
 * The layout restarts at full strength whenever nodes are added, so the whole graph would jolt. This force
 * runs last on every tick and caps node speed: settled nodes drift into place, a new node moves faster.
 */
export function calmForce(stable: StableGraph): Force {
  return force((nodes) => {
    for (const n of nodes) {
      const max = stable.maxSpeed(n.id);
      const speed = Math.hypot(n.vx ?? 0, n.vy ?? 0);
      if (speed > max) {
        const k = max / speed;
        n.vx = (n.vx ?? 0) * k;
        n.vy = (n.vy ?? 0) * k;
      }
    }
  });
}

/** Pulls each node towards the ring of its depth around its root; mild, so the layout stays organic. */
export function ringForce(stable: StableGraph): Force {
  return force((nodes, alpha) => {
    if (stable.targets) return;
    for (const n of nodes) {
      if (n.kind === "project" || !placed(n)) continue;
      let root: DrawNode | undefined = n;
      let level = 0;
      while (root && root.kind !== "project") {
        root = root.parent ? stable.nodes.get(root.parent) : undefined;
        level++;
      }
      if (!placed(root)) continue;
      const dx = n.x - root.x;
      const dy = n.y - root.y;
      const dist = Math.hypot(dx, dy) || 1;
      const k = ((level * RING - dist) / dist) * RING_STRENGTH * alpha;
      n.vx = (n.vx ?? 0) + dx * k;
      n.vy = (n.vy ?? 0) + dy * k;
    }
  });
}

/** While the graph is tidied, pulls every node towards its place in the crossing-free layout. */
export function relaxForce(stable: StableGraph, now: () => number = () => performance.now()): Force {
  return force((nodes) => {
    const targets = stable.targets;
    if (!targets) return;
    const ramp = Math.min(1, (now() - stable.relaxAt) / 1200);
    for (const n of nodes) {
      const t = targets.get(n.id);
      if (!t || !placed(n) || n.kind === "project") continue;
      // Glide: the velocity follows the distance to the target, blended in so the switch is not a jolt.
      n.vx = (n.vx ?? 0) * (1 - ramp) + (t.x - n.x) * RELAX_PULL * ramp;
      n.vy = (n.vy ?? 0) * (1 - ramp) + (t.y - n.y) * RELAX_PULL * ramp;
    }
  });
}

/** Repulsion and link springs: only the part → subpart tree shapes the layout; while tidying both step aside. */
export function forceStrengths(relaxing: boolean) {
  return {
    charge: relaxing ? CHARGE_RELAX : CHARGE,
    link: (l: DrawLink) => (relaxing ? 0 : l.hierarchy ? 1 : 0),
  };
}

const CROSS_FADE_S = 2.5;

/**
 * How visible a link is, 0..1. The tree is always shown. A link made by the agent's moves flashes while the
 * agent walks it and fades out; all links of a hovered or selected node show.
 */
export function linkPresence(link: DrawLink, now: number, shownIds: (string | null)[]): number {
  if (link.hierarchy) return 1;
  const a = linkEnd(link.source);
  const b = linkEnd(link.target);
  if (shownIds.some((id) => id && (id === a || id === b))) return 1;
  const since = (now - link.lastTouchAt) / 1000;
  if (link.touchCount > 0 && since >= 0 && since < CROSS_FADE_S) return 1 - since / CROSS_FADE_S;
  return 0;
}

/** Crossings between tree links (each pair of segments that intersect, sharing no end). */
export function treeCrossings(nodes: Iterable<DrawNode>, links: Iterable<DrawLink>): number {
  const at = new Map<string, Point>();
  for (const n of nodes) if (placed(n)) at.set(n.id, { x: n.x, y: n.y });
  const segs: [string, string, Point, Point][] = [];
  for (const l of links) {
    if (!l.hierarchy) continue;
    const a = linkEnd(l.source);
    const b = linkEnd(l.target);
    const p = at.get(a);
    const q = at.get(b);
    if (p && q) segs.push([a, b, p, q]);
  }
  const cross = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  let count = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const [a1, b1, p1, q1] = segs[i]!;
      const [a2, b2, p2, q2] = segs[j]!;
      if (a1 === a2 || a1 === b2 || b1 === a2 || b1 === b2) continue;
      const d1 = cross(p1, q1, p2);
      const d2 = cross(p1, q1, q2);
      const d3 = cross(p2, q2, p1);
      const d4 = cross(p2, q2, q1);
      if (d1 * d2 < 0 && d3 * d4 < 0) count++;
    }
  }
  return count;
}
