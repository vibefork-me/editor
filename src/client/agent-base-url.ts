export const AGENT_LOOPBACK_PORTS = [47801, 47802, 47803, 47804, 47805] as const;

export const AGENT_LOOPBACK_HOSTS = ["127.0.0.1", "[::1]"] as const;

const HELLO_PATH = "/v1/hello";

export function resolveAgentBaseUrlFromLocation(locationLike: Pick<Location, "origin" | "pathname">): string | null {
  if (locationLike.pathname.startsWith("/ui/") || locationLike.pathname === "/ui") {
    return locationLike.origin.replace(/\/$/, "");
  }
  return null;
}

export async function probeAgentBaseUrl(
  fetchFn: typeof fetch,
  baseUrl: string,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const res = await fetchFn(`${baseUrl}${HELLO_PATH}`, {
      method: "GET",
      headers: { "x-vibefork": "1" },
      signal,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function discoverAgentBaseUrl(
  fetchFn: typeof fetch,
  options?: {
    ports?: readonly number[];
    hosts?: readonly string[];
    perAttemptTimeoutMs?: number;
  },
): Promise<string | null> {
  const ports = options?.ports ?? AGENT_LOOPBACK_PORTS;
  const hosts = options?.hosts ?? AGENT_LOOPBACK_HOSTS;
  const timeoutMs = options?.perAttemptTimeoutMs ?? 400;

  for (const host of hosts) {
    for (const port of ports) {
      const base = `http://${host}:${port}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        if (await probeAgentBaseUrl(fetchFn, base, controller.signal)) {
          return base;
        }
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return null;
}

/** Backoff schedule in ms: 1s, 2s, 4s, 8s, then cap at 30s. */
export function reconnectDelayMs(attempt: number): number {
  const base = 1000 * 2 ** Math.max(0, attempt);
  return Math.min(base, 30_000);
}
