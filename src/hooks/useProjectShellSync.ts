import { useEffect } from "react";
import { useAgentClient } from "../client/react/useAgentClient.ts";
import { setWsConnectionListener } from "../client/ws-connection-bridge.ts";
import { bindAgentTransport } from "../stores/agent-bridge.ts";
import { useSessionStore } from "../stores/sessionStore.ts";

export function useProjectShellSync(): void {
  const client = useAgentClient();
  const setConnectionStatus = useSessionStore((s) => s.setConnectionStatus);

  useEffect(() => {
    bindAgentTransport(client);
    setConnectionStatus("connecting");
    setWsConnectionListener((event) => {
      if (event === "open") {
        setConnectionStatus("connected");
        return;
      }
      setConnectionStatus("reconnecting");
    });
    return () => {
      setWsConnectionListener(null);
      bindAgentTransport(null);
    };
  }, [client, setConnectionStatus]);
}
