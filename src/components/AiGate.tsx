import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { AiProvider } from "../client/types.ts";
import { useAgentClient } from "../client/react/useAgentClient.ts";
import { useI18n } from "../i18n/index.ts";
import { useSessionStore } from "../stores/sessionStore.ts";
import { ConnectAiScreen } from "./ConnectAiScreen.tsx";

export type AiGateProps = {
  children: ReactNode;
  pollIntervalMs?: number;
};

type AiGatePhase = "loading" | "no-ai" | "ready" | "error";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_MS = 10 * 60 * 1000;

export function AiGate({ children, pollIntervalMs = POLL_INTERVAL_MS }: AiGateProps) {
  const client = useAgentClient();
  const bearerToken = useSessionStore((state) => state.bearerToken);
  const { t } = useI18n();

  const [phase, setPhase] = useState<AiGatePhase>("loading");
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    setErrorMessage(null);
    try {
      const res = await client.getAiStatus();
      setProviders(res.providers);
      if (res.ready) {
        setPhase("ready");
      } else {
        setPhase("no-ai");
      }
      return res;
    } catch (_err) {
      setPhase("error");
      setErrorMessage(t("connectAi.errorNotice"));
      return null;
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
        const res = await client.getAiStatus();
        if (cancelled) return;
        setProviders(res.providers);
        if (res.ready) {
          setPhase("ready");
        } else {
          setPhase("no-ai");
        }
      } catch (_err) {
        if (cancelled) return;
        setPhase("error");
        setErrorMessage(t("connectAi.errorNotice"));
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

  const handleConnect = useCallback(
    async (providerId: string) => {
      setConnectingProvider(providerId);
      setErrorMessage(null);
      try {
        const res = await client.connectAi(providerId);
        if (!res.started) {
          setConnectingProvider(null);
          return;
        }
        const status = await checkStatus();
        if (status?.ready) {
          setConnectingProvider(null);
        }
      } catch (err: unknown) {
        setConnectingProvider(null);
        const msg = err instanceof Error ? err.message : String(err);
        const isBadKey =
          providerId === "openrouter" &&
          (msg.toLowerCase().includes("openrouter") ||
            msg.toLowerCase().includes("key") ||
            (typeof err === "object" && err !== null && "status" in err && (err as { status?: number }).status === 400));
        if (isBadKey) {
          setErrorMessage(t("connectAi.openRouterKeyRejected"));
        } else {
          setErrorMessage(msg || t("connectAi.errorNotice"));
        }
      }
    },
    [checkStatus, client, t],
  );

  // Poll GET /v1/ai every 3 seconds for up to 10 minutes when sign-in is started
  useEffect(() => {
    if (!connectingProvider) return;

    let cancelled = false;
    const startTime = Date.now();

    const interval = window.setInterval(async () => {
      if (cancelled) return;
      if (Date.now() - startTime > MAX_POLL_MS) {
        window.clearInterval(interval);
        setConnectingProvider(null);
        setErrorMessage(t("connectAi.timedOutNotice"));
        return;
      }

      try {
        const res = await client.getAiStatus();
        if (cancelled) return;
        setProviders(res.providers);
        if (res.ready) {
          window.clearInterval(interval);
          setConnectingProvider(null);
          setPhase("ready");
        }
      } catch {
        // Ignore transient poll errors
      }
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [client, connectingProvider, pollIntervalMs, t]);

  // Re-check automatically when user returns to the browser tab/window
  useEffect(() => {
    if (phase !== "no-ai" && phase !== "error") return;

    function handleFocus() {
      void checkStatus();
    }

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkStatus, phase]);

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
        providers={providers}
        connectingProvider={connectingProvider}
        onConnect={handleConnect}
        isChecking={isChecking}
        errorMessage={errorMessage}
        onRetry={checkStatus}
      />
    </div>
  );
}
