import { useEffect, useState } from "react";
import { useAgentClient } from "../client/react/useAgentClient.ts";

export function useModelLabel(): string | null {
  const client = useAgentClient();
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
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
  }, [client]);

  return label;
}
