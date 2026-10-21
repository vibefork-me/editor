/** Single-line CSP for meta tags and dev/preview headers (S-054). */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  [
    "connect-src 'self'",
    "http://127.0.0.1:47801 ws://127.0.0.1:47801",
    "http://127.0.0.1:47802 ws://127.0.0.1:47802",
    "http://127.0.0.1:47803 ws://127.0.0.1:47803",
    "http://127.0.0.1:47804 ws://127.0.0.1:47804",
    "http://127.0.0.1:47805 ws://127.0.0.1:47805",
    "http://[::1]:47801 ws://[::1]:47801",
    "http://[::1]:47802 ws://[::1]:47802",
    "http://[::1]:47803 ws://[::1]:47803",
    "http://[::1]:47804 ws://[::1]:47804",
    "http://[::1]:47805 ws://[::1]:47805",
  ].join(" "),
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "require-trusted-types-for 'script'",
  "trusted-types vibefork",
].join("; ");

/** HTTP response header adds frame-ancestors (not valid in meta CSP). */
export const CONTENT_SECURITY_POLICY_HEADER = `${CONTENT_SECURITY_POLICY}; frame-ancestors 'none'`;

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY_HEADER,
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "clipboard-read=(self), camera=(), microphone=(), geolocation=()",
  "X-Content-Type-Options": "nosniff",
};
