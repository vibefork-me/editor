import type { AgentTransport } from "../client/types.ts";

let agentTransport: AgentTransport | null = null;

export function bindAgentTransport(transport: AgentTransport | null): void {
  agentTransport = transport;
}

export function getAgentTransport(): AgentTransport | null {
  return agentTransport;
}
