# Vibefork Editor

Web editor shell for Vibefork.

## Stack

- React 19
- Vite
- TypeScript
- Tailwind CSS v4

## Security

Content Security Policy (CSP) is configured per security specification:
- `script-src 'self'` strictly, without `'unsafe-eval'`.
- `connect-src` limited to origin and loopback agent ports (`47801-47805`).

## Scripts

```sh
npm install
npm run dev
npm run build
npm run preview
npm run check         # build, language keys, first-screen budget, unit tests
npm run check:i18n    # keys of every interface language against English
npm run check:canvas  # headless canvas check on made-up sessions; needs Chrome or Edge (or CHROME_PATH)
```

`check:canvas` plays made-up analyses of 26 and 259 parts on the developer canvas (`/dev/canvas`) and shows
made-up maps on the project page (`/dev/<project>`), then requires 0 tree crossings, 0 overlapping parts, every
part in the frame, no drift at rest and at least 45 frames per second; screenshots go to `canvas-check/`.

## Languages

Interface texts live in `src/i18n/locales/<code>.ts`; the languages and their status are in `src/i18n/config.ts`
(`ready` — fully translated, offered to people; `declared` — recognized from the browser, any missing text shown
in English). English is in the first-screen bundle, every other language is a separate chunk loaded when chosen.
Texts are ICU messages: `{name}`, `{n, number}`, `{n, plural, one {# file} other {# files}}` (CLDR plural rules
via `Intl.PluralRules`), `{kind, select, … other {…}}`. Numbers, sizes and dates go through `Intl`
(`formatNumber`, `formatBytes`, `formatDate`).

`check:i18n` fails when a ready language misses a key, any language has a key English lacks, or a text uses
other values than the English one. On the dev server, `?pseudo` in the address shows every dictionary text
accented, longer and in `⟦…⟧`: text without the brackets is written into the code.

## License

MIT
