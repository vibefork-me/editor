import { discoverAgentBaseUrl, fetchAgentHello } from "./agent-base-url.ts";

export type AgentOfflineReason = "agent-not-running" | "local-network-blocked";

export type AgentReachability =
  | { status: "online"; extraOrigins?: string[] }
  | { status: "offline"; reason: AgentOfflineReason };

export const WINDOWS_INSTALL_PS_COMMAND = "irm https://vibefork.me/install.ps1 | iex";

const LOCAL_NETWORK_HINT =
  /local network|private network access|loopback|127\.0\.0\.1|notallowederror/i;

export function classifyAgentProbeError(error: unknown): AgentOfflineReason {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "local-network-blocked";
  }
  const message = error instanceof Error ? error.message : String(error);
  if (LOCAL_NETWORK_HINT.test(message)) {
    return "local-network-blocked";
  }
  return "agent-not-running";
}

export async function probeAgentReachability(
  fetchFn: typeof fetch = fetch,
): Promise<AgentReachability> {
  try {
    const base = await discoverAgentBaseUrl(fetchFn, { perAttemptTimeoutMs: 350 });
    if (base) {
      const hello = await fetchAgentHello(fetchFn, base);
      if (hello) {
        return {
          status: "online",
          ...(hello.extraOrigins && hello.extraOrigins.length > 0
            ? { extraOrigins: hello.extraOrigins }
            : {}),
        };
      }
    }
    return { status: "offline", reason: "agent-not-running" };
  } catch (error) {
    return { status: "offline", reason: classifyAgentProbeError(error) };
  }
}
