import { useMemo, type ReactNode } from "react";
import { createAgentTransport } from "../create-agent-transport.ts";
import type { AgentTransportDeps } from "../create-agent-transport.ts";
import { AgentClientContext } from "./AgentClientContext.ts";
import { getPairedKeyId, signNonce } from "../../security/browserKeyStore.ts";

export type AgentClientProviderProps = {
  children: ReactNode;
  transport?: AgentTransportDeps;
};

export function AgentClientProvider({ children, transport }: AgentClientProviderProps) {
  const client = useMemo(
    () =>
      createAgentTransport({
        discover: typeof window !== "undefined",
        location: typeof window !== "undefined" ? window.location : undefined,
        getKeyId: async () => {
          const keyId = await getPairedKeyId();
          if (!keyId) throw new Error("Browser identity has not been paired");
          return keyId;
        },
        signNonce,
        ...transport,
      }),
    [transport],
  );

  return <AgentClientContext.Provider value={client}>{children}</AgentClientContext.Provider>;
}
