import { createContext } from "react";
import type { AgentTransport } from "../types.ts";

export const AgentClientContext = createContext<AgentTransport | null>(null);
