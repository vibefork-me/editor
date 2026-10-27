// Fails if a locked package could come from anywhere but the npm registry, or has no integrity hash.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = "https://registry.npmjs.org/";

const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
const errors = [];
let checked = 0;

for (const [path, pkg] of Object.entries(lock.packages ?? {})) {
  // The root project and workspace links have no download.
  if (path === "" || pkg.link) continue;
  checked += 1;
  if (!pkg.resolved?.startsWith(REGISTRY)) {
    errors.push(`${path}: resolved from ${pkg.resolved ?? "nowhere"}`);
  } else if (!pkg.integrity) {
    errors.push(`${path}: no integrity hash`);
  }
}

if (errors.length > 0) {
  const more = errors.length > 20 ? `\n  … and ${errors.length - 20} more` : "";
  console.error(`Dependency source violations (${errors.length}):\n  ${errors.slice(0, 20).join("\n  ")}${more}`);
  process.exit(1);
}
console.log(`sources ok: ${checked} packages from ${REGISTRY}`);
