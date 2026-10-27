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
npm run check         # build, first-screen budget, unit tests
npm run check:canvas  # headless canvas check on made-up sessions; needs Chrome or Edge (or CHROME_PATH)
```

`check:canvas` plays made-up analyses of 26 and 259 parts on the developer canvas (`/dev/canvas`) and shows
made-up maps on the project page (`/dev/<project>`), then requires 0 tree crossings, 0 overlapping parts, every
part in the frame, no drift at rest and at least 45 frames per second; screenshots go to `canvas-check/`.

## License

MIT
