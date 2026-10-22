import { useEffect, useState } from "react";
import { useAgentClient } from "../client/react/useAgentClient.ts";
import {
  probeAgentReachability,
  type AgentOfflineReason,
  type AgentReachability,
} from "../client/probe-agent-reachability.ts";

const POLL_MS = 2000;

export type AgentConnectionState = {
  online: boolean;
  offlineReason: AgentOfflineReason;
  exiting: boolean;
  extraOrigins?: string[];
};

export function useAgentConnectionMonitor(pollMs = POLL_MS): AgentConnectionState {
  const client = useAgentClient();
  const [reachability, setReachability] = useState<AgentReachability>({
    status: "offline",
    reason: "agent-not-running",
  });
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      const health = await client.getHealth();
      let next: AgentReachability = health.ok
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
      } else {
        setExiting(false);
        setReachability(next);
      }
    };

    void tick();
    const id = setInterval(() => {
      void tick();
    }, pollMs);

    return () => {
      cancelled = true;
      clearInterval(id);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [client, pollMs]);

  return {
    online: reachability.status === "online",
    offlineReason:
      reachability.status === "offline" ? reachability.reason : "agent-not-running",
    exiting,
    extraOrigins: reachability.status === "online" ? reachability.extraOrigins : undefined,
  };
}
