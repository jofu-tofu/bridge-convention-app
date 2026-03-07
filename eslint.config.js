import eslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import sveltePlugin from "eslint-plugin-svelte";
import svelteParser from "svelte-eslint-parser";
import unusedImports from "eslint-plugin-unused-imports";

const UNUSED_VAR_RULE = [
  "warn",
  { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
];

const UNUSED_IMPORTS_VAR_RULE = [
  "warn",
  { args: "all", argsIgnorePattern: "^_", vars: "all", varsIgnorePattern: "^_" },
];

function restrictImports(message, group) {
  return { group, message };
}

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
      "node_modules/**",
      "src-tauri/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "_output/**",
      ".aiwcli/**",
    ],
    linterOptions: {
      reportUnusedDisableDirectives: "warn",
    },
  },
  // TypeScript files
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": eslint,
      "unused-imports": unusedImports,
    },
    rules: {
      ...eslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": UNUSED_IMPORTS_VAR_RULE,
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "error",
      "no-console": "warn",
    },
  },
  // CLI files — console is expected
  {
    files: ["src/cli/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
  // Pure engine logic must stay UI/platform independent.
  {
    files: ["src/engine/**/*.ts"],
    ignores: [
      "src/engine/__tests__/**",
      "src/engine/tauri-ipc-engine.ts",
      "src/engine/wasm-engine.ts",
      "src/engine/dds-client.ts",
      "src/engine/dds-worker.ts",
    ],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          restrictImports(
            "Pure engine modules must stay independent from UI, stores, and strategy layers.",
            [
              "svelte",
              "svelte/*",
              "@tauri-apps/*",
              "**/components/**",
              "**/stores/**",
              "**/display/**",
              "**/strategy/**",
              "**/drill/**",
            ],
          ),
        ],
      }],
      "no-restricted-globals": ["error",
        { name: "window", message: "Pure engine modules must not depend on browser globals." },
        { name: "document", message: "Pure engine modules must not depend on browser globals." },
        { name: "localStorage", message: "Pure engine modules must not depend on browser globals." },
      ],
    },
  },
  // Inference stays pure and should not depend on UI or orchestration layers.
  {
    files: ["src/inference/**/*.ts"],
    ignores: ["src/inference/__tests__/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          restrictImports(
            "Inference must stay independent from UI, stores, drill flow, and strategy code.",
            [
              "svelte",
              "svelte/*",
              "@tauri-apps/*",
              "**/components/**",
              "**/stores/**",
              "**/drill/**",
              "**/display/**",
              "**/strategy/**",
            ],
          ),
        ],
      }],
    },
  },
  // Convention definitions/core stay self-contained and should not reach into UI or strategy layers.
  {
    files: ["src/conventions/**/*.ts"],
    ignores: ["src/conventions/**/__tests__/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          restrictImports(
            "Convention code must stay independent from UI, stores, display, and strategy layers.",
            [
              "svelte",
              "svelte/*",
              "@tauri-apps/*",
              "**/components/**",
              "**/stores/**",
              "**/display/**",
              "**/strategy/**",
            ],
          ),
        ],
      }],
    },
  },
  // Strategy remains a pure decision layer.
  {
    files: ["src/strategy/**/*.ts"],
    ignores: ["src/strategy/__tests__/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          restrictImports(
            "Strategy code must stay independent from UI, stores, display, and drill flow.",
            [
              "svelte",
              "svelte/*",
              "@tauri-apps/*",
              "**/components/**",
              "**/stores/**",
              "**/display/**",
              "**/drill/**",
            ],
          ),
        ],
      }],
    },
  },
  // Drill coordinates configuration/session logic, not UI.
  {
    files: ["src/drill/**/*.ts"],
    ignores: ["src/drill/__tests__/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          restrictImports(
            "Drill code must stay independent from UI, stores, and display helpers.",
            [
              "svelte",
              "svelte/*",
              "@tauri-apps/*",
              "**/components/**",
              "**/stores/**",
              "**/display/**",
            ],
          ),
        ],
      }],
    },
  },
  // Stores are allowed to call the engine boundary but should avoid engine internals.
  {
    files: ["src/stores/**/*.ts"],
    ignores: ["src/stores/__tests__/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          restrictImports(
            "Stores must not depend on components directly.",
            ["**/components/**"],
          ),
          restrictImports(
            "Stores should use the engine boundary and shared helpers, not arbitrary engine internals.",
            [
              "../engine/**",
              "!../engine/port",
              "!../engine/types",
              "!../engine/constants",
              "!../engine/hand-evaluator",
              "!../engine/call-helpers",
            ],
          ),
        ],
      }],
    },
  },
  // The main game store should stay on the inference DTO boundary rather than conventions/core.
  {
    files: ["src/stores/game.svelte.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          restrictImports(
            "game.svelte.ts should consume inference DTOs instead of conventions/core internals.",
            ["../conventions/core/**"],
          ),
        ],
      }],
    },
  },
  // Components may use engine types/constants but not engine internals.
  {
    files: ["src/components/**/*.svelte", "src/components/**/*.ts"],
    ignores: ["src/components/__tests__/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          restrictImports(
            "Components should only depend on engine types/constants/port, not engine internals.",
            [
              "**/engine/**",
              "!**/engine/types",
              "!**/engine/constants",
              "!**/engine/port",
            ],
          ),
        ],
      }],
    },
  },
  // Svelte files
  ...sveltePlugin.configs["flat/recommended"].map((config) => ({
    ...config,
    files: ["**/*.svelte"],
    languageOptions: {
      ...config.languageOptions,
      parser: svelteParser,
      parserOptions: {
        ...config.languageOptions?.parserOptions,
        parser: tsParser,
      },
    },
    plugins: {
      ...config.plugins,
      "@typescript-eslint": eslint,
      "unused-imports": unusedImports,
    },
    rules: {
      ...(config.rules ?? {}),
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": UNUSED_IMPORTS_VAR_RULE,
    },
  })),
];
