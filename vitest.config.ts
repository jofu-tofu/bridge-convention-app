import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    include: ["src/**/*.test.ts"],
    environment: "jsdom",
    globals: true,
    coverage: {
      provider: "v8",
      include: ["src/engine/**", "src/conventions/**", "src/ai/**", "src/cli/**"],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 85,
      },
    },
  },
});
