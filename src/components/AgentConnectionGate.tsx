import type { ReactNode } from "react";
import { useAgentConnectionMonitor } from "../hooks/useAgentConnectionMonitor.ts";
import { useMobileUnsupported } from "../hooks/useMobileUnsupported.ts";
import { AgentOfflineScreen } from "./AgentOfflineScreen.tsx";
import { PairingGate } from "./PairingGate.tsx";
import { MobileUnsupportedNotice } from "./MobileUnsupportedNotice.tsx";
import { SecurityWarningBanner } from "./SecurityWarningBanner.tsx";

export type AgentConnectionGateProps = {
  children: ReactNode;
};

export function AgentConnectionGate({ children }: AgentConnectionGateProps) {
  const mobileUnsupported = useMobileUnsupported();
  const { online, offlineReason, exiting, extraOrigins } = useAgentConnectionMonitor();

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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <SecurityWarningBanner extraOrigins={extraOrigins} />
      <PairingGate>{children}</PairingGate>
    </div>
  );
}
