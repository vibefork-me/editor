import { create } from "zustand";
import type { ConnectionStatus } from "./types.ts";

export interface SessionState {
  bearerToken: string | null;
  connectionStatus: ConnectionStatus;
  lastError: string | null;
  setBearerToken: (token: string | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setLastError: (error: string | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  bearerToken: null,
  connectionStatus: "disconnected",
  lastError: null,
  setBearerToken: (token) => set({ bearerToken: token }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setLastError: (error) => set({ lastError: error }),
}));
