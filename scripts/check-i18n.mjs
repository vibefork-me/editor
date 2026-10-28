// Key check of the interface languages (part of `npm run check`).
//
// For every language in src/i18n/config.ts against English, the source:
// - `ready`: the file exists and has exactly the English keys;
// - `declared`: the file may be missing or partial (coverage is printed), but has no keys English lacks;
// - every text parses as a message and uses the same values as the English one;
// - no file in src/i18n/locales belongs to an undeclared language;
// - the terms of src/i18n/glossary.json: where the English text has a term, the translation says it the
//   agreed way; no text uses a forbidden spelling; the form of address and every term are given for every
//   language.
// Runs the TypeScript sources directly (Node strips the types).
import { readFileSync, readdirSync } from "node:fs";
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

// Glossary: checked in every language with a dictionary; a missing key is the key check's business.
const glossary = JSON.parse(readFileSync(join(i18n, "glossary.json"), "utf8"));
const dictionaries = new Map([[SOURCE_LOCALE, source]]);
for (const locale of Object.keys(LOCALE_STATUS)) {
  if (locale === SOURCE_LOCALE) continue;
  const raw = await dictionary(locale);
  if (raw) dictionaries.set(locale, flatten(raw));
}
for (const [locale, texts] of dictionaries) {
  for (const [key, text] of texts) {
    for (const spelling of glossary.forbidden ?? []) {
      if (typeof text === "string" && text.includes(spelling)) errors.push(`${locale}: ${key}: "${spelling}" (glossary forbids it)`);
    }
  }
}
for (const locale of Object.keys(LOCALE_STATUS)) {
  if (!glossary.address?.[locale]) errors.push(`glossary: no form of address for ${locale}`);
  for (const term of glossary.terms) {
    if (!term.say?.[locale]) errors.push(`glossary: term "${term.id}" is not given for ${locale}`);
  }
}
for (const term of glossary.terms) {
  if (!term.match) continue;
  const flags = term.caseSensitive ? "u" : "iu";
  const pattern = new RegExp(term.match, flags);
  for (const [key, english] of source) {
    // Values such as `{parts}` are names, not words of the text.
    if (typeof english !== "string" || !pattern.test(english.replace(/\{\s*\w+\s*\}/g, ""))) continue;
    for (const [locale, texts] of dictionaries) {
      if (locale === SOURCE_LOCALE || term.except?.[locale]?.includes(key)) continue;
      const text = texts.get(key);
      const expected = term.expect?.[locale];
      if (typeof text !== "string" || !expected) continue;
      const haystack = term.caseSensitive ? text : text.toLocaleLowerCase(locale);
      const found = expected.some((e) => haystack.includes(term.caseSensitive ? e : e.toLocaleLowerCase(locale)));
      if (!found) errors.push(`${locale}: ${key}: glossary term "${term.id}" should be ${expected.map((e) => `"${e}"`).join(" or ")}`);
    }
  }
}

for (const file of readdirSync(join(i18n, "locales"))) {
  const locale = file.replace(/\.ts$/, "");
  if (!(locale in LOCALE_STATUS)) errors.push(`src/i18n/locales/${file}: language not declared in config.ts`);
}

if (errors.length) {
  console.error(`i18n check failed:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
console.log(`i18n ok: ${source.size} keys in ${SOURCE_LOCALE}, ${glossary.terms.length} glossary terms`);
