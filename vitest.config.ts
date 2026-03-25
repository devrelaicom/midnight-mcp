import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/bin.ts", "src/scripts/**"],
      // Ratchet: set just below current actuals to catch regressions.
      // Increase as test coverage grows.
      thresholds: {
        statements: 17,
        branches: 12,
        functions: 14,
        lines: 17,
      },
    },
  },
});
