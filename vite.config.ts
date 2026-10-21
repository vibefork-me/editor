import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {
  CONTENT_SECURITY_POLICY,
  SECURITY_HEADERS,
} from "./csp.config.ts";

function injectCspMeta(): Plugin {
  return {
    name: "inject-csp-meta",
    transformIndexHtml(html) {
      return html.replace(
        /content="%%CSP%%"/,
        `content="${CONTENT_SECURITY_POLICY}"`,
      );
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [injectCspMeta(), react(), tailwindcss()],
  server: {
    port: 5173,
    headers: SECURITY_HEADERS,
  },
  preview: {
    headers: SECURITY_HEADERS,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (/monaco|elkjs/.test(id)) {
              return "blocked-heavy-vendor";
            }
            return "vendor";
          }
        },
      },
    },
  },
});
