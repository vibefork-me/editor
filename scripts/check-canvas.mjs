// Headless check of the canvas on made-up sessions: tree crossings, overlapping parts, parts out of
// the frame, drift at rest and frames per second, with a screenshot of each case.
//
//   npm run check:canvas [-- --out <dir>]
//
// Needs Chrome or Edge on the machine: CHROME_PATH, else the installed Chrome, else Edge.
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.indexOf("--out");
const out = resolve(outArg > 0 ? process.argv[outArg + 1] : join(root, "canvas-check"));
const MIN_FPS = 45;
const MAX_DRIFT = 1;

const CASES = [
  // The developer canvas plays a made-up analysis as a session stream.
  { name: "stream-26", path: "dev/canvas?size=26&speed=4" },
  { name: "stream-259", path: "dev/canvas?size=259&speed=8" },
  // The project page with the map of a made-up agent and no session stream.
  { name: "map-26", path: "dev/notes-app?size=26&stream=0&panels=" },
  { name: "map-259", path: "dev/notes-app?size=259&stream=0&panels=" },
  // The project page after a task, with every panel open; the camera shows the changed parts only.
  { name: "notes-panels", path: "dev/notes-app?session=notes&panels=files,code,journal&file=src/ui/theme.ts&diff=1", wholeInFrame: false },
];

async function launch() {
  const tries = [
    process.env.CHROME_PATH && { executablePath: process.env.CHROME_PATH },
    { channel: "chrome" },
    { channel: "msedge" },
  ].filter(Boolean);
  for (const how of tries) {
    try {
      return await chromium.launch({ ...how, headless: true });
    } catch {
      // Not here: the next one.
    }
  }
  console.error("No Chrome or Edge found: install one or set CHROME_PATH.");
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Frames drawn in `ms` of page time, per second. */
const fps = (page, ms) =>
  page.evaluate(
    (ms) =>
      new Promise((done) => {
        let frames = 0;
        const start = performance.now();
        const tick = (now) => {
          frames += 1;
          if (now - start < ms) requestAnimationFrame(tick);
          else done(Math.round((frames * 1000) / (now - start)));
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );

/** Node positions now, by id. */
const positions = (page) =>
  page.evaluate(() => Object.fromEntries([...(window.__vfCanvas?.stable.nodes.values() ?? [])].map((n) => [n.id, [n.x ?? 0, n.y ?? 0]])));

const maxMove = (a, b) => Math.max(0, ...Object.keys(b).filter((id) => a[id]).map((id) => Math.hypot(b[id][0] - a[id][0], b[id][1] - a[id][1])));

/** Crossings, overlaps and parts out of the frame, measured in the page. */
const measure = (page) =>
  page.evaluate(async () => {
    const { treeCrossings } = await import("/src/canvas/graph/stableGraph.ts");
    const { nodeRadius } = await import("/src/canvas/graph/paint.ts");
    const c = window.__vfCanvas;
    const nodes = [...c.stable.nodes.values()];
    let overlaps = 0;
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) <= nodeRadius(a) + nodeRadius(b)) overlaps += 1;
      }
    const el = document.querySelector('[data-testid="graph-canvas"]');
    const w = el?.clientWidth ?? 0;
    const h = el?.clientHeight ?? 0;
    const outside = nodes.filter((n) => {
      const p = c.toScreen(n.x, n.y);
      return p.x < 0 || p.y < 0 || p.x > w || p.y > h;
    }).length;
    return { parts: nodes.length, crossings: treeCrossings(nodes, c.stable.links.values()), overlaps, outside };
  });

const server = await createServer({ root, logLevel: "error", server: { host: "127.0.0.1", port: 0 } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await launch();
mkdirSync(out, { recursive: true });
const rows = [];
let failed = false;

try {
  for (const c of CASES) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      try {
        localStorage.setItem("vf_locale", "en");
      } catch {}
    });
    await page.goto(base + c.path);
    await page.waitForFunction(() => window.__vfCanvas && window.__vfCanvas.stable.nodes.size > 0, null, { timeout: 30_000 });
    const growing = await fps(page, 2000);
    await page.waitForFunction(() => window.__vfCanvas.played(), null, { timeout: 120_000 });
    // At rest: nothing moves more than half a unit in half a second, twice in a row (at most 30 s).
    let calm = 0;
    for (let i = 0; i < 60 && calm < 2; i++) {
      const a = await positions(page);
      await sleep(500);
      calm = maxMove(a, await positions(page)) < 0.5 ? calm + 1 : 0;
    }
    // The camera fits the graph after it settles.
    await sleep(1500);
    const before = await positions(page);
    const resting = await fps(page, 2000);
    const drift = maxMove(before, await positions(page));
    const m = await measure(page);
    await page.screenshot({ path: join(out, `${c.name}.png`) });
    const ok = m.crossings === 0 && m.overlaps === 0 && (m.outside === 0 || c.wholeInFrame === false) && drift <= MAX_DRIFT && growing >= MIN_FPS && resting >= MIN_FPS && errors.length === 0;
    failed ||= !ok;
    rows.push({ case: c.name, ...m, drift: Math.round(drift * 100) / 100, fpsGrowing: growing, fpsResting: resting, errors: errors.length, ok });
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}

console.table(rows);
console.log(`Thresholds: 0 crossings, 0 overlaps, 0 parts out of the frame, drift <= ${MAX_DRIFT}, >= ${MIN_FPS} fps. Screenshots: ${out}`);
process.exit(failed ? 1 : 0);
