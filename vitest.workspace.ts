import { defineWorkspace } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

// Two test projects:
//  - "node": server/DB/util tests (*.test.ts) in the node environment.
//  - "dom":  React component tests (*.test.tsx) in jsdom with Testing Library.
export default defineWorkspace([
  {
    resolve: { alias },
    test: {
      name: "node",
      environment: "node",
      include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
      setupFiles: ["./tests/setup-env.ts"],
      testTimeout: 30000,
      hookTimeout: 30000,
    },
  },
  {
    plugins: [react()],
    resolve: { alias },
    test: {
      name: "dom",
      environment: "jsdom",
      include: ["tests/**/*.test.tsx", "src/**/*.test.tsx"],
      setupFiles: ["./tests/setup-env.ts", "./tests/setup-dom.ts"],
    },
  },
]);
