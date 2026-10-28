// Context of every interface text for reviewing translations (dev only, not part of `npm run check`).
//
// For each key of the editor's dictionaries: the text in every language, where the key is used (file,
// component, the JSX around it), its role (button, title, error, hint…), the keys next to it in its section,
// and flags: a translation that runs too long for its role, or one still equal to English.
// With `--agent <path to the agent repo>` the same for the agent's Fluent messages (crates/vf-core/locales):
// the group of the message, the catalog function that reads it and where that function is called.
//
//   node scripts/i18n-context.mjs [--key <prefix>] [--agent <dir>] [--flags] [--json]
//
// `--key` keeps the keys (editor) or ids (agent) starting with the prefix; `--flags` keeps only the flagged
// ones; `--json` prints one JSON array instead of Markdown.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const i18n = join(root, "src", "i18n");
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const prefix = option("--key") ?? "";
const agentDir = option("--agent");
const onlyFlags = args.includes("--flags");
const asJson = args.includes("--json");

const { LOCALE_STATUS, SOURCE_LOCALE } = await import(pathToFileURL(join(i18n, "config.ts")).href);
const LOCALES = Object.keys(LOCALE_STATUS);

// Roles whose text sits in a narrow place: a translation longer than `ratio` × English (and `slack` chars)
// is flagged.
const NARROW = { button: { ratio: 1.6, slack: 6 }, label: { ratio: 1.6, slack: 6 }, badge: { ratio: 1.6, slack: 4 },
  tab: { ratio: 1.6, slack: 4 }, menu: { ratio: 1.6, slack: 8 }, tray: { ratio: 1.5, slack: 8 } };

function flatten(obj, prefix = "", out = new Map()) {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") flatten(value, full, out);
    else out.set(full, value);
  }
  return out;
}

function walk(dir, keep, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, keep, out);
    else if (keep(path)) out.push(path);
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

// The role of a text: first from the JSX or call around its use, then from the key's name.
function roleOf(key, around) {
  const last = key.split(".").pop();
  if (/placeholder=\{?\s*$/.test(around) || /placeholder/i.test(last)) return "placeholder";
  if (/aria-label=\{?\s*$/.test(around) || /(Aria|Label)$/.test(last)) return "label";
  if (/title=\{?\s*$/.test(around)) return "tooltip";
  if (/<(h[1-6])\b[^<]*$/.test(around) || /Title$|^title$/.test(last)) return "title";
  if (/<(button|Button|a)\b[^<]*$/.test(around) || /Action$|^(retry|close|send|copy|run|stop|resume|build|rebuild|undo)$/.test(last)) return "button";
  if (/Badge$|^badge/.test(last)) return "badge";
  if (/Tab$|^tabs$/.test(last)) return "tab";
  if (/(error|Error|Failed|failed|NotConfirmed|Rejected|denied)/.test(last) || key.startsWith("agentErrors.")) return "error";
  if (/(Hint|hint|Notice|Note|Description|description|Text|Instructions)$/.test(last)) return "hint";
  return "text";
}

function flagsOf(role, texts, english) {
  const flags = [];
  const limit = NARROW[role];
  for (const [locale, text] of Object.entries(texts)) {
    if (locale === SOURCE_LOCALE || typeof text !== "string") continue;
    if (limit && text.length > Math.max(english.length * limit.ratio, english.length + limit.slack)) {
      flags.push(`${locale}: ${text.length} chars for a ${role} (en ${english.length})`);
    }
    if (text === english && /[a-z]{3}/.test(english.replace(/\{[^}]*\}/g, ""))) flags.push(`${locale}: same as en`);
  }
  return flags;
}

// --- Editor -------------------------------------------------------------------------------------------
const dictionaries = {};
for (const locale of LOCALES) {
  const file = join(i18n, "locales", `${locale}.ts`);
  if (!existsSync(file)) continue;
  const module = await import(pathToFileURL(file).href);
  dictionaries[locale] = flatten(module[locale.replace("-", "")] ?? module.default);
}
const source = dictionaries[SOURCE_LOCALE];

const sources = walk(join(root, "src"), (p) => /\.(tsx?)$/.test(p) && !/\.test\.tsx?$/.test(p) && !p.includes(join("src", "i18n", "locales")));
const uses = new Map([...source.keys()].map((k) => [k, []]));
for (const file of sources) {
  const code = readFileSync(file, "utf8");
  const rel = relative(root, file).replaceAll("\\", "/");
  const components = [...code.matchAll(/(?:function|const)\s+([A-Z]\w*)\s*[=(<]/g)].map((m) => ({ name: m[1], at: m.index }));
  const componentAt = (index) => components.filter((c) => c.at <= index).pop()?.name ?? "(module)";
  const note = (key, index) => {
    const around = code.slice(Math.max(0, code.lastIndexOf("\n", index - 1) - 160), index);
    uses.get(key)?.push({ file: rel, line: lineOf(code, index), component: componentAt(index), around });
  };
  // Literal keys: "section.key", 'section.key', `section.key`.
  for (const m of code.matchAll(/["'`]([a-zA-Z]+\.[a-zA-Z0-9]+)["'`]/g)) if (source.has(m[1])) note(m[1], m.index);
  // Built keys: `section.${x}` or `section.${x}Suffix` stand for every key of the section that fits.
  for (const m of code.matchAll(/`([a-zA-Z]+)\.\$\{[^}]+\}([a-zA-Z0-9]*)`/g)) {
    const [, section, suffix] = m;
    for (const key of source.keys()) {
      const last = key.slice(section.length + 1);
      if (key.startsWith(`${section}.`) && last.endsWith(suffix) && (suffix || !/Long$/.test(last))) note(key, m.index);
    }
  }
}

const entries = [];
for (const [key, english] of source) {
  if (!key.startsWith(prefix)) continue;
  const section = key.split(".")[0];
  const siblings = [...source.keys()].filter((k) => k.startsWith(`${section}.`));
  const at = siblings.indexOf(key);
  const where = uses.get(key) ?? [];
  const role = roleOf(key, where[0]?.around ?? "");
  const texts = Object.fromEntries(LOCALES.map((l) => [l, dictionaries[l]?.get(key)]));
  entries.push({
    surface: "editor",
    key,
    role,
    used: where.map((u) => `${u.file}:${u.line} (${u.component})`),
    neighbours: siblings.slice(Math.max(0, at - 3), at + 4).filter((k) => k !== key),
    texts,
    flags: [...(where.length ? [] : ["not found in the code (built at run time, or unused)"]), ...flagsOf(role, texts, english)],
  });
}

// --- Agent --------------------------------------------------------------------------------------------
function parseFtl(text) {
  const out = new Map();
  let group = "";
  let id = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("## ")) group = line.slice(3).trim();
    else if (/^[a-z][\w-]*\s*=/.test(line)) {
      id = line.split("=")[0].trim();
      out.set(id, { group, value: line.slice(line.indexOf("=") + 1).trim() });
    } else if (id && /^\s/.test(line) && line.trim()) out.get(id).value += `\n${line.trim()}`;
    else if (!line.trim()) continue;
    else id = null;
  }
  return out;
}

if (agentDir) {
  const locales = join(agentDir, "crates", "vf-core", "locales");
  const ftl = Object.fromEntries(LOCALES.map((l) => [l, existsSync(join(locales, `${l}.ftl`)) ? parseFtl(readFileSync(join(locales, `${l}.ftl`), "utf8")) : new Map()]));
  const catalog = readFileSync(join(agentDir, "crates", "vf-core", "src", "catalog.rs"), "utf8");
  const fns = [...catalog.matchAll(/pub fn (\w+)\s*\(/g)].map((m) => ({ name: m[1], at: m.index }));
  const rust = walk(join(agentDir, "crates"), (p) => p.endsWith(".rs") && !p.includes(`${join("vf-core", "src", "catalog.rs")}`) && !/[\\/]tests[\\/]/.test(p));
  const code = rust.map((p) => ({ rel: relative(agentDir, p).replaceAll("\\", "/"), text: readFileSync(p, "utf8") }));
  for (const [id, { group, value }] of ftl[SOURCE_LOCALE]) {
    if (!id.startsWith(prefix)) continue;
    const at = catalog.indexOf(`"${id}"`);
    const fn = at >= 0 ? fns.filter((f) => f.at <= at).pop()?.name : undefined;
    const used = [];
    if (fn) {
      for (const { rel, text } of code) {
        for (const m of text.matchAll(new RegExp(`\\b${fn}\\s*\\(`, "g"))) used.push(`${rel}:${lineOf(text, m.index)}`);
      }
    }
    const role = /tray/i.test(group) ? "tray" : /button/i.test(group) ? "button" : /command line/i.test(group) ? "cli" : /dialog|action|key|value/i.test(group) ? "dialog" : "text";
    const texts = Object.fromEntries(LOCALES.map((l) => [l, ftl[l].get(id)?.value]));
    const ids = [...ftl[SOURCE_LOCALE].keys()].filter((k) => ftl[SOURCE_LOCALE].get(k).group === group);
    const i = ids.indexOf(id);
    entries.push({
      surface: "agent",
      key: id,
      role,
      group,
      used: [fn ? `catalog::${fn}` : "(not read through catalog.rs)", ...used],
      neighbours: ids.slice(Math.max(0, i - 3), i + 4).filter((k) => k !== id),
      texts,
      flags: [...(fn && !used.length ? ["catalog function not called outside tests"] : []), ...flagsOf(role, texts, value)],
    });
  }
}

const shown = onlyFlags ? entries.filter((e) => e.flags.length) : entries;
if (asJson) {
  console.log(JSON.stringify(shown, null, 2));
} else {
  for (const e of shown) {
    console.log(`## ${e.surface}: ${e.key} — ${e.role}${e.group ? ` (${e.group})` : ""}`);
    console.log(`used: ${e.used.join("; ") || "—"}`);
    console.log(`next to: ${e.neighbours.join(", ") || "—"}`);
    for (const [locale, text] of Object.entries(e.texts)) console.log(`  ${locale.padEnd(5)} ${String(text).replaceAll("\n", "⏎")}`);
    for (const f of e.flags) console.log(`  ! ${f}`);
    console.log("");
  }
  console.error(`${shown.length} of ${entries.length} texts shown`);
}
