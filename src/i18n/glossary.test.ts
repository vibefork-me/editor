import { describe, expect, it } from "vitest";
import glossary from "./glossary.json";
import { en } from "./locales/en.ts";

function texts(obj: Record<string, unknown>, out: string[] = []): string[] {
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") texts(value as Record<string, unknown>, out);
    else if (typeof value === "string") out.push(value);
  }
  return out;
}

const pattern = (id: string) => {
  const term = glossary.terms.find((t) => t.id === id);
  if (!term?.match) throw new Error(`no match for glossary term "${id}"`);
  return new RegExp(term.match, "iu");
};

describe("glossary", () => {
  it("has no control characters in `match` (a JSON \"\\b\" is a backspace, not a word boundary)", () => {
    for (const term of glossary.terms) {
      if (term.match) expect(term.match, term.id).not.toMatch(/[\u0000-\u001f]/);
    }
  });

  it.each([
    ["computer", "Runs on your computer", "computerized"],
    ["add", "Add an AI", "address"],
  ])("matches the whole word of the term \"%s\"", (id, text, notText) => {
    expect(pattern(id).test(text)).toBe(true);
    expect(pattern(id).test(notText)).toBe(false);
  });

  it.each(["computer", "add"])("checks the English texts that use the term \"%s\"", (id) => {
    expect(texts(en as unknown as Record<string, unknown>).some((t) => pattern(id).test(t))).toBe(true);
  });
});
