import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Shared config for all Vitest projects. Test environments are split per
// project in vitest.workspace.ts (node for server/DB tests, jsdom for
// component tests).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
