/// <reference types="node" />
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import tailwindcss from "@tailwindcss/vite";

// Plugin order matters: wasm() must run before sveltekit() so .wasm imports resolve
// before Svelte compilation. tailwindcss() before sveltekit() per Tailwind v4 docs.
export default defineConfig({
  plugins: [wasm(), tailwindcss(), sveltekit()],

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: true,
    watch: {
      ignored: ["**/crates/**", "**/_output/**", "**/target/**", "**/.generated/**"],
    },
    fs: {
      allow: ["."],
    },
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
