import { registerTrustedTypes } from "./security/registerTrustedTypes.ts";
registerTrustedTypes();

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AgentClientProvider } from "./client/index.ts";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

createRoot(container).render(
  <StrictMode>
    <AgentClientProvider>
      <App />
    </AgentClientProvider>
  </StrictMode>,
);
