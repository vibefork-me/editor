import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {
  CONTENT_SECURITY_POLICY,
  DEV_CONTENT_SECURITY_POLICY,
  DEV_SECURITY_HEADERS,
  SECURITY_HEADERS,
} from "./csp.config.ts";

function injectCspMeta(): Plugin {
  return {
    name: "inject-csp-meta",
    transformIndexHtml(html, ctx) {
      const csp = ctx.server ? DEV_CONTENT_SECURITY_POLICY : CONTENT_SECURITY_POLICY;
      return html.replace(
        /content="%%CSP%%"/,
        `content="${csp}"`,
      );
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [injectCspMeta(), react(), tailwindcss()],
  server: {
    port: 5173,
    headers: DEV_SECURITY_HEADERS,
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
