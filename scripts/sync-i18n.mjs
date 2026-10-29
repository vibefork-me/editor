// Copies the shared language list and glossary (vibefork-me/shared packages/i18n) into src/i18n/shared and
// records where they come from in src/i18n/shared/SOURCE.json (commit and sha256 of each file), which
// `check:i18n` holds the copy to.
// Usage: node scripts/sync-i18n.mjs [path to shared/packages/i18n]
// The source must be a clean git checkout, so the copy matches a commit of the shared repository.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FILES = ["locales.json", "glossary.json"];
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "src", "i18n", "shared");

const fallback = ["../shared/packages/i18n", "../../shared/packages/i18n"]
  .map((p) => join(root, p))
  .find(existsSync);
const source = process.argv[2] ?? fallback;
if (!source || !existsSync(source)) {
  console.error("sync-i18n: no shared/packages/i18n next to the editor; pass its path");
  process.exit(1);
}

const git = (...args) => execFileSync("git", ["-C", source, ...args], { encoding: "utf8" }).trim();
const dirty = git("status", "--porcelain", "--", ...FILES);
if (dirty) {
  console.error(`sync-i18n: ${source} has uncommitted changes:\n${dirty}`);
  process.exit(1);
}

const files = {};
for (const file of FILES) {
  const bytes = readFileSync(join(source, file));
  writeFileSync(join(target, file), bytes);
  files[file] = createHash("sha256").update(bytes).digest("hex");
}
const record = { repository: "vibefork-me/shared", commit: git("rev-parse", "HEAD"), files };
writeFileSync(join(target, "SOURCE.json"), JSON.stringify(record, null, 2) + "\n");
console.log(`synced from ${source} at ${record.commit}`);
