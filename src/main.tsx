import { registerTrustedTypes } from "./security/registerTrustedTypes.ts";
registerTrustedTypes();

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AgentClientProvider } from "./client/index.ts";
import { loadLocale, useI18nStore } from "./i18n/i18nStore.ts";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

// The first screen waits for the person's language (one small chunk; English is bundled), so it never
// flashes in English first.
void loadLocale(useI18nStore.getState().locale).finally(() => {
  createRoot(container).render(
    <StrictMode>
      <AgentClientProvider>
        <App />
      </AgentClientProvider>
    </StrictMode>,
  );
});
