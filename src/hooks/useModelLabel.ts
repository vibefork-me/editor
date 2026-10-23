import { useEffect, useState } from "react";
import { useAgentClient } from "../client/react/useAgentClient.ts";
import { useSessionStore } from "../stores/sessionStore.ts";

export function useModelLabel(): string | null {
  const client = useAgentClient();
  const bearerToken = useSessionStore((state) => state.bearerToken);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!bearerToken) {
      setLabel(null);
      return;
    }
    let cancelled = false;
    void client
      .getModels()
      .then((models) => {
        if (cancelled || models.length === 0) return;
        const preferred = models.find((m) => m.tier === 0) ?? models[0];
        setLabel(preferred.label);
      })
      .catch(() => {
        if (!cancelled) setLabel(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bearerToken, client]);

  return label;
}
