import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    headers: {
      "Content-Security-Policy":
        "default-src 'none'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://127.0.0.1:47801 ws://127.0.0.1:47801 http://127.0.0.1:47802 ws://127.0.0.1:47802 http://127.0.0.1:47803 ws://127.0.0.1:47803 http://127.0.0.1:47804 ws://127.0.0.1:47804 http://127.0.0.1:47805 ws://127.0.0.1:47805 http://[::1]:47801 ws://[::1]:47801 http://[::1]:47802 ws://[::1]:47802 http://[::1]:47803 ws://[::1]:47803 http://[::1]:47804 ws://[::1]:47804 http://[::1]:47805 ws://[::1]:47805; base-uri 'none'; object-src 'none'; form-action 'none';",
    },
  },
  preview: {
    headers: {
      "Content-Security-Policy":
        "default-src 'none'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://127.0.0.1:47801 ws://127.0.0.1:47801 http://127.0.0.1:47802 ws://127.0.0.1:47802 http://127.0.0.1:47803 ws://127.0.0.1:47803 http://127.0.0.1:47804 ws://127.0.0.1:47804 http://127.0.0.1:47805 ws://127.0.0.1:47805 http://[::1]:47801 ws://[::1]:47801 http://[::1]:47802 ws://[::1]:47802 http://[::1]:47803 ws://[::1]:47803 http://[::1]:47804 ws://[::1]:47804 http://[::1]:47805 ws://[::1]:47805; base-uri 'none'; object-src 'none'; form-action 'none';",
    },
  },
});
