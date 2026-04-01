/// <reference types="node" />
import path from "path";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// TAURI_DEV_HOST — set by `tauri dev` for mobile/remote dev (e.g., Cloudflare tunnel).
// When set, HMR uses explicit WebSocket connection to this host.
const host = process.env.TAURI_DEV_HOST;

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
        "src-tauri/crates/bridge-wasm/pkg",
      ),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || true,
    allowedHosts: [".trycloudflare.com"], // Cloudflare tunnel for remote Tauri dev
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
