import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAgentClient } from "../client/react/useAgentClient.ts";
import { useI18n } from "../i18n/index.ts";
import { useSessionStore } from "../stores/sessionStore.ts";
import { ConnectAiScreen } from "./ConnectAiScreen.tsx";

export type AiGateProps = {
  children: ReactNode;
};

type AiGatePhase = "loading" | "no-models" | "ready" | "error";

export function AiGate({ children }: AiGateProps) {
  const client = useAgentClient();
  const bearerToken = useSessionStore((state) => state.bearerToken);
  const { t } = useI18n();

  const [phase, setPhase] = useState<AiGatePhase>("loading");
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkModels = useCallback(async () => {
    setIsChecking(true);
    setErrorMessage(null);
    try {
      const models = await client.getModels();
      if (models.length > 0) {
        setPhase("ready");
      } else {
        setPhase("no-models");
      }
    } catch (err) {
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsChecking(false);
    }
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    async function initialCheck() {
      if (!bearerToken) return;
      setIsChecking(true);
      try {
        const models = await client.getModels();
        if (cancelled) return;
        if (models.length > 0) {
          setPhase("ready");
        } else {
          setPhase("no-models");
        }
      } catch (err) {
        if (cancelled) return;
        setPhase("error");
        setErrorMessage(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    }

    void initialCheck();
    return () => {
      cancelled = true;
    };
  }, [bearerToken, client]);

  // Re-check automatically when user returns to the browser tab/window
  useEffect(() => {
    if (phase !== "no-models" && phase !== "error") return;

    function handleFocus() {
      void checkModels();
    }

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkModels, phase]);

  if (phase === "ready") {
    return <>{children}</>;
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center p-6" role="status" aria-busy="true">
        <p className="text-sm text-neutral-400">{t("connectAi.checking")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <ConnectAiScreen
        isChecking={isChecking}
        errorMessage={errorMessage}
        onRetry={checkModels}
      />
    </div>
  );
}
