// Key check of the interface languages (part of `npm run check`).
//
// For every language in src/i18n/config.ts against English, the source:
// - `ready`: the file exists and has exactly the English keys;
// - `declared`: the file may be missing or partial (coverage is printed), but has no keys English lacks;
// - every text parses as a message and uses the same values as the English one;
// - no file in src/i18n/locales belongs to an undeclared language.
// Runs the TypeScript sources directly (Node strips the types).
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const i18n = join(root, "src", "i18n");
const load = (file) => import(pathToFileURL(join(i18n, file)).href);

const { LOCALE_STATUS, SOURCE_LOCALE } = await load("config.ts");
const { messageArguments } = await load("format.ts");

function flatten(obj, prefix = "", out = new Map()) {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") flatten(value, full, out);
    else out.set(full, value);
  }
  return out;
}

async function dictionary(locale) {
  const files = readdirSync(join(i18n, "locales"));
  if (!files.includes(`${locale}.ts`)) return undefined;
  const module = await load(`locales/${locale}.ts`);
  return module[locale.replace("-", "")] ?? module.default;
}

const errors = [];
const source = flatten(await dictionary(SOURCE_LOCALE));
const sourceArgs = new Map();
for (const [key, text] of source) {
  const args = typeof text === "string" ? messageArguments(text) : null;
  if (!args) errors.push(`${SOURCE_LOCALE}: ${key}: not a valid message`);
  sourceArgs.set(key, JSON.stringify(args));
}

for (const [locale, status] of Object.entries(LOCALE_STATUS)) {
  if (locale === SOURCE_LOCALE) continue;
  const raw = await dictionary(locale);
  if (!raw) {
    if (status === "ready") errors.push(`${locale}: ready, but src/i18n/locales/${locale}.ts is missing`);
    console.log(`${locale} (${status}): 0/${source.size} keys, shown in English`);
    continue;
  }
  const keys = flatten(raw);
  const missing = [...source.keys()].filter((k) => !keys.has(k));
  for (const key of keys.keys()) {
    if (!source.has(key)) errors.push(`${locale}: ${key}: not in ${SOURCE_LOCALE}`);
  }
  if (status === "ready") {
    for (const key of missing) errors.push(`${locale}: ${key}: missing`);
  }
  for (const [key, text] of keys) {
    if (!source.has(key)) continue;
    const args = typeof text === "string" ? messageArguments(text) : null;
    if (!args) errors.push(`${locale}: ${key}: not a valid message`);
    else if (JSON.stringify(args) !== sourceArgs.get(key)) {
      errors.push(`${locale}: ${key}: uses ${args.join(", ") || "no values"}, ${SOURCE_LOCALE} uses ${JSON.parse(sourceArgs.get(key))?.join(", ") || "no values"}`);
    }
  }
  console.log(`${locale} (${status}): ${source.size - missing.length}/${source.size} keys`);
}

for (const file of readdirSync(join(i18n, "locales"))) {
  const locale = file.replace(/\.ts$/, "");
  if (!(locale in LOCALE_STATUS)) errors.push(`src/i18n/locales/${file}: language not declared in config.ts`);
}

if (errors.length) {
  console.error(`i18n check failed:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
console.log(`i18n ok: ${source.size} keys in ${SOURCE_LOCALE}`);
