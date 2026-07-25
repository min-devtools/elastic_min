import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Single source of truth for this app's release version.
const version = readFileSync(new URL("./VERSION", import.meta.url), "utf8").trim();

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "safari15",
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        // keep the ~4MB editor out of the app chunk so app code changes don't
        // invalidate the monaco cache entry (monaco-vim stays lazy-loaded)
        manualChunks: { monaco: ["monaco-editor"] },
      },
    },
  },
});
