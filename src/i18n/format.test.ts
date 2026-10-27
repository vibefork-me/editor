import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatDate,
  formatMessage,
  formatNumber,
  formatPseudo,
  messageArguments,
  parseMessage,
  unitName,
} from "./format.ts";

describe("messages", () => {
  it("fills values in as they are", () => {
    expect(formatMessage("en", "Port {port} of {name}", { port: 47801, name: "notes-app" })).toBe(
      "Port 47801 of notes-app",
    );
    expect(formatMessage("en", "No values here, it's plain")).toBe("No values here, it's plain");
    expect(formatMessage("en", "Missing {value}")).toBe("Missing {value}");
  });

  it("writes numbers in the language's notation when asked", () => {
    expect(formatMessage("en", "{n, number} s", { n: 1.5 })).toBe("1.5 s");
    expect(formatMessage("ru", "{n, number} с", { n: 1.5 })).toBe("1,5 с");
  });

  it("chooses plural forms by CLDR rules, exact matches first", () => {
    const files = "{n, plural, =0 {no files} one {# file} other {# files}}";
    expect(formatMessage("en", files, { n: 0 })).toBe("no files");
    expect(formatMessage("en", files, { n: 1 })).toBe("1 file");
    expect(formatMessage("en", files, { n: 1200 })).toBe("1,200 files");

    const ru = "{n, plural, one {# файл} few {# файла} many {# файлов} other {# файла}}";
    expect([1, 2, 5, 11, 21, 22, 25, 1.5].map((n) => formatMessage("ru", ru, { n }))).toEqual([
      "1 файл",
      "2 файла",
      "5 файлов",
      "11 файлов",
      "21 файл",
      "22 файла",
      "25 файлов",
      "1,5 файла",
    ]);

    const pt = "{n, plural, one {# arquivo} many {# de arquivos} other {# arquivos}}";
    expect(formatMessage("pt-BR", pt, { n: 1 })).toBe("1 arquivo");
    expect(formatMessage("pt-BR", pt, { n: 2 })).toBe("2 arquivos");
  });

  it("chooses by a string value, nested in plurals too", () => {
    const msg = "{who, select, agent {The agent changed {n, plural, one {# part} other {# parts}}} other {Changed}}";
    expect(formatMessage("en", msg, { who: "agent", n: 2 })).toBe("The agent changed 2 parts");
    expect(formatMessage("en", msg, { who: "person", n: 2 })).toBe("Changed");
  });

  it("shows a broken message as written instead of throwing", () => {
    for (const broken of ["{n, plural, one {x}}", "{n, plural, other {x}", "{", "}", "{n, date}"]) {
      expect(parseMessage(broken)).toBeNull();
      expect(formatMessage("en", broken, { n: 1 })).toBe(broken);
    }
  });

  it("lists the values a message uses", () => {
    expect(messageArguments("{a} and {n, plural, one {# {b}} other {# {c}}}")).toEqual(["a", "b", "c", "n"]);
    expect(messageArguments("{a")).toBeNull();
  });
});

describe("Intl formats", () => {
  it("numbers, sizes and dates follow the language", () => {
    expect(formatNumber("en", 1234.5)).toBe("1,234.5");
    expect(formatNumber("de", 1234.5)).toBe("1.234,5");
    expect(formatBytes("en", 1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatBytes("ru", 1.5 * 1024 * 1024)).toBe("1,5 МБ");
    expect(formatBytes("en", 300)).toBe("0.3 kB");
    expect(formatBytes("en", 250 * 1024)).toBe("250 kB");
    expect(unitName("en", "megabyte")).toBe("MB");
    expect(unitName("ru", "megabyte")).toBe("МБ");
    const day = Date.UTC(2026, 9, 28, 12);
    expect(formatDate("en", day, { dateStyle: "long", timeZone: "UTC" })).toBe("October 28, 2026");
    expect(formatDate("de", day, { dateStyle: "long", timeZone: "UTC" })).toBe("28. Oktober 2026");
  });
});

describe("pseudo-language", () => {
  it("accents and lengthens text but keeps values and plural syntax", () => {
    expect(formatPseudo("en", "Hello {name}", { name: "Ann" })).toBe("⟦Ĥéļļö ··Ann⟧");
    expect(formatPseudo("en", "{n, plural, one {# file} other {# files}}", { n: 3 })).toBe("⟦3 ƒîļéš··⟧");
  });
});
