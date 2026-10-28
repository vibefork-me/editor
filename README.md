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
in English). The interface is in English, Russian, Brazilian Portuguese, Spanish and German; each language is
named in itself (`LOCALE_NAMES`), outside the dictionaries. English is in the first-screen bundle, every other
language is a separate chunk loaded when chosen.
Texts are ICU messages: `{name}`, `{n, number}`, `{n, plural, one {# file} other {# files}}` (CLDR plural rules
via `Intl.PluralRules`), `{kind, select, … other {…}}`. Numbers, sizes and dates go through `Intl`
(`formatNumber`, `formatBytes`, `formatDate`).

`check:i18n` fails when a ready language misses a key, any language has a key English lacks, or a text uses
other values than the English one. It also holds every language to the product glossary
(`src/i18n/glossary.json`: the terms, their agreed translations and the form of address — `você`, `tú`, `du`):
where the English text has a term, the translation uses the agreed word, and no text uses a forbidden spelling
such as `VibeFork`. On the dev server, `?pseudo` in the address shows every dictionary text
accented, longer and in `⟦…⟧`: text without the brackets is written into the code.

`npm run i18n:context` prints every text for review: its translations, where it is used (file, component), its
role (button, title, error, hint…), the keys next to it, and flags — a translation too long for a narrow role
(button, badge, tab, tray) or still equal to English. `-- --key <prefix>` narrows it, `-- --flags` keeps the
flagged texts, `-- --agent <dir>` adds the agent's Fluent messages with the place each one is read,
`-- --json` prints JSON.

## License

MIT
