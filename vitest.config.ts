import path from "path";
import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  resolve: {
    conditions: ["browser"],
    alias: {
      "bridge-wasm": path.resolve(
        __dirname,
        "crates/bridge-wasm/pkg",
      ),
      "$app/navigation": path.resolve(
        __dirname,
        "src/test-support/sveltekit-mocks/navigation.ts",
      ),
      "$app/state": path.resolve(
        __dirname,
        "src/test-support/sveltekit-mocks/state.ts",
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "jsdom",
    globals: true,
    coverage: {
      provider: "v8",
      include: [
        "src/engine/**",
        "src/service/**",
        "src/stores/**",
      ],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 85,
      },
    },
  },
});
