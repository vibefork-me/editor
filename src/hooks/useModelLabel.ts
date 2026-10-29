import { useEffect, useState } from "react";
import { useAgentClient } from "../client/react/useAgentClient.ts";
import { useSessionStore } from "../stores/sessionStore.ts";

/** The AI the agent works with: a name a person knows (`Claude`, `ChatGPT`) and the model. */
export type ModelLabel = { name: string; model: string };

const PROVIDER_NAMES: Record<string, string> = {
  claude: "Claude",
  codex: "ChatGPT",
  copilot: "GitHub Copilot",
  openrouter: "OpenRouter",
};

export function useModelLabel(): ModelLabel | null {
  const client = useAgentClient();
  const bearerToken = useSessionStore((state) => state.bearerToken);
  const [label, setLabel] = useState<ModelLabel | null>(null);

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
        setLabel({ name: PROVIDER_NAMES[preferred.provider] ?? preferred.provider, model: preferred.label });
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
