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
```

## License

MIT
