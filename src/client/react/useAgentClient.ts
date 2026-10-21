import { useContext } from "react";
import { AgentClientContext } from "./AgentClientContext.ts";

export function useAgentClient() {
  const client = useContext(AgentClientContext);
  if (!client) {
    throw new Error("useAgentClient must be used within AgentClientProvider");
  }
  return client;
}
