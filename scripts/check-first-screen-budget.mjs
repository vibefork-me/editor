import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dist = join(root, "dist");
const indexHtml = join(dist, "index.html");
const BUDGET_BYTES = 350 * 1024;
const FORBIDDEN = /monaco|elkjs|blocked-heavy-vendor/i;

if (!existsSync(indexHtml)) {
  console.error("dist/index.html missing — run vite build first");
  process.exit(1);
}

const html = readFileSync(indexHtml, "utf8");
const assetRefs = new Set();
for (const match of html.matchAll(/\b(?:src|href)="(\.\/assets\/[^"]+)"/g)) {
  assetRefs.add(match[1]);
}

const indexChunks = [...assetRefs].filter((p) => /index-[^/]+\.js$/i.test(p));
if (indexChunks.length === 0) {
  console.error("No index-*.js entry in dist/index.html");
  process.exit(1);
}

let totalGzip = 0;
const lines = [];
for (const rel of assetRefs) {
  if (FORBIDDEN.test(rel)) {
    console.error(`Forbidden chunk in first screen: ${rel}`);
    process.exit(1);
  }
  const abs = join(dist, rel.replace(/^\.\//, ""));
  if (!existsSync(abs)) {
    console.error(`Missing asset: ${rel}`);
    process.exit(1);
  }
  const raw = readFileSync(abs);
  const gz = gzipSync(raw);
  totalGzip += gz.length;
  lines.push(`${rel}: ${gz.length} B gzip (${raw.length} B raw)`);
}

console.log("First-screen assets (gzip):");
for (const line of lines) {
  console.log(`  ${line}`);
}
console.log(`Total gzip: ${totalGzip} B (budget ${BUDGET_BYTES} B)`);

if (totalGzip > BUDGET_BYTES) {
  console.error("First-screen bundle budget exceeded");
  process.exit(1);
}
