import type { ReactNode } from "react";
import { useAgentConnectionMonitor } from "../hooks/useAgentConnectionMonitor.ts";
import { useMobileUnsupported } from "../hooks/useMobileUnsupported.ts";
import { AgentOfflineScreen } from "./AgentOfflineScreen.tsx";
import { MobileUnsupportedNotice } from "./MobileUnsupportedNotice.tsx";

export type AgentConnectionGateProps = {
  children: ReactNode;
};

export function AgentConnectionGate({ children }: AgentConnectionGateProps) {
  const mobileUnsupported = useMobileUnsupported();
  const { online, offlineReason, exiting } = useAgentConnectionMonitor();

  if (mobileUnsupported) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <MobileUnsupportedNotice />
      </div>
    );
  }

  if (!online) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <AgentOfflineScreen reason={offlineReason} exiting={exiting} />
      </div>
    );
  }

  return <>{children}</>;
}
