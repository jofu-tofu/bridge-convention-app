/// <reference types="node" />
import path from "path";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// https://vite.dev/config/
// Plugin order matters: wasm() must run before svelte() so .wasm imports resolve
// before Svelte compilation. tailwindcss() before svelte() per Tailwind v4 docs.
export default defineConfig({
  plugins: [wasm(), tailwindcss(), svelte()],
  publicDir: "static",

  resolve: {
    alias: {
      "bridge-wasm": path.resolve(
        __dirname,
        "crates/bridge-wasm/pkg",
      ),
    },
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: true,
    watch: {
      ignored: ["**/crates/**"],
    },
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
