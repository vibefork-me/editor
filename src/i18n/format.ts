/**
 * Messages in a subset of ICU MessageFormat, formatted with the browser's `Intl`:
 *
 * - `{name}` — the value as is (ports, codes and years stay without separators);
 * - `{name, number}` — a number in the language's notation (`1,5` in Russian, `1.5` in English);
 * - `{name, plural, =0 {…} one {# file} few {…} many {…} other {# files}}` — CLDR plural rules of the
 *   language (`Intl.PluralRules`); `#` is the number in the language's notation; `=N` matches exactly;
 * - `{name, select, a {…} other {…}}` — a choice by a string value.
 *
 * Apostrophes are ordinary text (no ICU quoting); a message cannot show `{` or `}` themselves. A message
 * that does not parse is shown as written, never thrown.
 *
 * No imports: the key check (`scripts/check-i18n.mjs`) runs this file in Node too.
 */

export type MessageValue = string | number;
export type MessageParams = Record<string, MessageValue>;

type Part =
  | { kind: "text"; text: string }
  | { kind: "pound" }
  | { kind: "arg"; name: string; number: boolean }
  | { kind: "plural" | "select"; name: string; options: Map<string, Part[]> };

export type Message = Part[];

class Parser {
  private pos = 0;
  private readonly src: string;
  constructor(src: string) {
    this.src = src;
  }

  message(inPlural: boolean, nested: boolean): Message | null {
    const parts: Part[] = [];
    let text = "";
    const flush = () => {
      if (text) parts.push({ kind: "text", text });
      text = "";
    };
    while (this.pos < this.src.length) {
      const c = this.src[this.pos]!;
      if (c === "}") {
        if (!nested) return null;
        break;
      }
      if (c === "{") {
        flush();
        const arg = this.argument(inPlural);
        if (!arg) return null;
        parts.push(arg);
        continue;
      }
      if (c === "#" && inPlural) {
        flush();
        parts.push({ kind: "pound" });
        this.pos++;
        continue;
      }
      text += c;
      this.pos++;
    }
    flush();
    return parts;
  }

  private skipSpace() {
    while (/\s/.test(this.src[this.pos] ?? "")) this.pos++;
  }

  private word(): string {
    const start = this.pos;
    while (this.pos < this.src.length && !/[\s,{}]/.test(this.src[this.pos]!)) this.pos++;
    return this.src.slice(start, this.pos);
  }

  private eat(c: string): boolean {
    this.skipSpace();
    if (this.src[this.pos] !== c) return false;
    this.pos++;
    return true;
  }

  private argument(inPlural: boolean): Part | null {
    this.pos++; // "{"
    this.skipSpace();
    const name = this.word();
    if (!name) return null;
    if (this.eat("}")) return { kind: "arg", name, number: false };
    if (!this.eat(",")) return null;
    this.skipSpace();
    const type = this.word();
    if (type === "number") {
      return this.eat("}") ? { kind: "arg", name, number: true } : null;
    }
    if (type !== "plural" && type !== "select") return null;
    if (!this.eat(",")) return null;
    const options = new Map<string, Part[]>();
    for (;;) {
      if (this.eat("}")) break;
      this.skipSpace();
      const key = this.word();
      if (!key || !this.eat("{")) return null;
      const body = this.message(inPlural || type === "plural", true);
      if (!body || !this.eat("}")) return null;
      options.set(key, body);
    }
    return options.has("other") ? { kind: type, name, options } : null;
  }
}

const parsed = new Map<string, Message | null>();

/** The message parsed, or `null` when it is not valid. */
export function parseMessage(src: string): Message | null {
  let message = parsed.get(src);
  if (message === undefined) {
    message = new Parser(src).message(false, false);
    parsed.set(src, message);
  }
  return message;
}

/** Names of the values a message uses, sorted; `null` when it is not valid. */
export function messageArguments(src: string): string[] | null {
  const message = parseMessage(src);
  if (!message) return null;
  const names = new Set<string>();
  const walk = (parts: Part[]) => {
    for (const p of parts) {
      if (p.kind === "arg") names.add(p.name);
      if (p.kind === "plural" || p.kind === "select") {
        names.add(p.name);
        for (const body of p.options.values()) walk(body);
      }
    }
  };
  walk(message);
  return [...names].sort();
}

function cached<T>(cache: Map<string, T>, key: string, make: () => T): T {
  let value = cache.get(key);
  if (value === undefined) {
    value = make();
    cache.set(key, value);
  }
  return value;
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const pluralRules = new Map<string, Intl.PluralRules>();

/** A number in the language's notation. */
export function formatNumber(locale: string, value: number, options?: Intl.NumberFormatOptions): string {
  const key = `${locale}|${JSON.stringify(options ?? {})}`;
  return cached(numberFormats, key, () => new Intl.NumberFormat(locale, options)).format(value);
}

function pluralCategory(locale: string, value: number): string {
  return cached(pluralRules, locale, () => new Intl.PluralRules(locale)).select(value);
}

function render(locale: string, parts: Part[], params: MessageParams, count: number | undefined): string {
  let out = "";
  for (const p of parts) {
    switch (p.kind) {
      case "text":
        out += p.text;
        break;
      case "pound":
        out += count === undefined ? "#" : formatNumber(locale, count);
        break;
      case "arg": {
        const value = params[p.name];
        if (value === undefined) out += `{${p.name}}`;
        else out += p.number && typeof value === "number" ? formatNumber(locale, value) : String(value);
        break;
      }
      case "plural": {
        const n = Number(params[p.name]);
        const body =
          p.options.get(`=${n}`) ?? (Number.isFinite(n) ? p.options.get(pluralCategory(locale, n)) : undefined) ??
          p.options.get("other")!;
        out += render(locale, body, params, n);
        break;
      }
      case "select": {
        const body = p.options.get(String(params[p.name])) ?? p.options.get("other")!;
        out += render(locale, body, params, count);
        break;
      }
    }
  }
  return out;
}

/** The message with its values filled in by the rules of `locale`; the source as is when it does not parse. */
export function formatMessage(locale: string, src: string, params: MessageParams = {}): string {
  const message = parseMessage(src);
  return message ? render(locale, message, params, undefined) : src;
}

const BYTE_UNITS = [
  [1024 ** 3, "gigabyte"],
  [1024 ** 2, "megabyte"],
  [1024, "kilobyte"],
] as const;

/** The unit that fits a size: KB under a megabyte, MB under a gigabyte, GB above. */
export function byteUnit(bytes: number): { divisor: number; unit: "kilobyte" | "megabyte" | "gigabyte" } {
  for (const [divisor, unit] of BYTE_UNITS) {
    if (bytes >= divisor) return { divisor, unit };
  }
  return { divisor: 1024, unit: "kilobyte" };
}

/** The short name of a unit in the language: `MB` in English, `МБ` in Russian. */
export function unitName(locale: string, unit: string): string {
  const parts = cached(
    numberFormats,
    `${locale}|unit:${unit}`,
    () => new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "short" }),
  ).formatToParts(1);
  return parts.find((p) => p.type === "unit")?.value ?? unit;
}

/** A size in bytes in the language's notation: `1.5 MB`, `1,5 МБ`; one decimal under 100 of a unit. */
export function formatBytes(locale: string, bytes: number): string {
  const { divisor, unit } = byteUnit(bytes);
  const value = bytes / divisor;
  return formatNumber(locale, value, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: value >= 100 ? 0 : 1,
  });
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** A date and/or time in the language's notation (`Intl.DateTimeFormat`; date only by default). */
export function formatDate(locale: string, date: Date | number, options?: Intl.DateTimeFormatOptions): string {
  const key = `${locale}|${JSON.stringify(options ?? {})}`;
  return cached(dateFormats, key, () => new Intl.DateTimeFormat(locale, options)).format(date);
}

const PSEUDO_LETTERS: Record<string, string> = {
  a: "à", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "î", j: "ĵ", k: "ķ", l: "ļ", m: "ɱ",
  n: "ñ", o: "ö", p: "þ", q: "ǫ", r: "ŕ", s: "š", t: "ţ", u: "û", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Å", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Î", J: "Ĵ", K: "Ķ", L: "Ļ", M: "Ṁ",
  N: "Ñ", O: "Ö", P: "Þ", Q: "Ǫ", R: "Ŕ", S: "Š", T: "Ţ", U: "Û", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};

function pseudoText(text: string): string {
  const accented = text.replace(/[A-Za-z]/g, (c) => PSEUDO_LETTERS[c] ?? c);
  // About a third longer, like many translations, so cramped layouts show up too.
  const padding = "·".repeat(Math.ceil(text.replace(/\s/g, "").length / 3));
  return accented + padding;
}

function pseudoParts(parts: Part[]): Part[] {
  return parts.map((p) => {
    if (p.kind === "text") return { kind: "text", text: pseudoText(p.text) };
    if (p.kind === "plural" || p.kind === "select") {
      return { ...p, options: new Map([...p.options].map(([k, body]) => [k, pseudoParts(body)])) };
    }
    return p;
  });
}

/**
 * The message in the pseudo-language: accented, longer, in `⟦…⟧`. Values stay as they are. Text on screen
 * without the brackets did not come through the dictionary: it is written into the code.
 */
export function formatPseudo(locale: string, src: string, params: MessageParams = {}): string {
  const message = parseMessage(src);
  if (!message) return `⟦${src}⟧`;
  return `⟦${render(locale, pseudoParts(message), params, undefined)}⟧`;
}
