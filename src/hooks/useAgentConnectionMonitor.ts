import { useEffect, useState } from "react";
import { useAgentClient } from "../client/react/useAgentClient.ts";
import {
  probeAgentReachability,
  type AgentOfflineReason,
  type AgentReachability,
} from "../client/probe-agent-reachability.ts";

export const OFFLINE_POLL_MS = 2000;
export const ONLINE_POLL_MS = 30000;

export type AgentConnectionState = {
  online: boolean;
  offlineReason: AgentOfflineReason;
  exiting: boolean;
  extraOrigins?: string[];
};

export type AgentConnectionMonitorOptions = {
  offlinePollMs?: number;
  onlinePollMs?: number;
};

export function useAgentConnectionMonitor(
  optionsOrPollMs?: number | AgentConnectionMonitorOptions,
): AgentConnectionState {
  const offlineMs =
    typeof optionsOrPollMs === "number"
      ? optionsOrPollMs
      : optionsOrPollMs?.offlinePollMs ?? OFFLINE_POLL_MS;
  const onlineMs =
    typeof optionsOrPollMs === "number"
      ? optionsOrPollMs * 15
      : optionsOrPollMs?.onlinePollMs ?? ONLINE_POLL_MS;

  const client = useAgentClient();
  const [reachability, setReachability] = useState<AgentReachability>({
    status: "offline",
    reason: "agent-not-running",
  });
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleNext = (delayMs: number) => {
      if (cancelled) return;
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = setTimeout(() => {
        void tick();
      }, delayMs);
    };

    const tick = async () => {
      const health = await client.getHealth();
      const next: AgentReachability = health.ok
        ? {
            status: "online",
            ...(health.extraOrigins && health.extraOrigins.length > 0
              ? { extraOrigins: health.extraOrigins }
              : {}),
          }
        : await probeAgentReachability();

      if (cancelled) return;

      if (next.status === "online") {
        setExiting(true);
        exitTimer = setTimeout(() => {
          if (!cancelled) {
            setReachability(next);
            setExiting(false);
          }
        }, 220);
        scheduleNext(onlineMs);
      } else {
        setExiting(false);
        setReachability(next);
        scheduleNext(offlineMs);
      }
    };

    void tick();

    const onFocus = () => {
      if (!cancelled) {
        void tick();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onFocus);
    }

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (exitTimer) clearTimeout(exitTimer);
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onFocus);
      }
    };
  }, [client, offlineMs, onlineMs]);

  return {
    online: reachability.status === "online",
    offlineReason:
      reachability.status === "offline" ? reachability.reason : "agent-not-running",
    exiting,
    extraOrigins: reachability.status === "online" ? reachability.extraOrigins : undefined,
  };
}
