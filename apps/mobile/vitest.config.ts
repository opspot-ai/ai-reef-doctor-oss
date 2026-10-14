import { defineConfig } from "vitest/config";

// Pure-logic unit tests for mobile helpers (no RN runtime needed).
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
