import tseslint from "typescript-eslint";
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

// Reused forbidden-import patterns for module boundary enforcement
const svelteImports = [
  { name: "svelte", message: "Module boundary violation: no svelte imports" },
  {
    name: "svelte/*",
    message: "Module boundary violation: no svelte imports",
  },
];
const storeImports = [
  {
    name: "../stores/*",
    message: "Module boundary violation: no store imports",
  },
  {
    name: "../../stores/*",
    message: "Module boundary violation: no store imports",
  },
  {
    name: "../../../stores/*",
    message: "Module boundary violation: no store imports",
  },
];
const componentImports = [
  {
    name: "../components/*",
    message: "Module boundary violation: no component imports",
  },
  {
    name: "../../components/*",
    message: "Module boundary violation: no component imports",
  },
  {
    name: "../../../components/*",
    message: "Module boundary violation: no component imports",
  },
];
const strategyImports = [
  {
    name: "../strategy/*",
    message: "Module boundary violation: no strategy imports",
  },
  {
    name: "../../strategy/*",
    message: "Module boundary violation: no strategy imports",
  },
  {
    name: "../../../strategy/*",
    message: "Module boundary violation: no strategy imports",
  },
];

/** @type {import("eslint").Linter.Config[]} */
export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "node_modules/",
      "src-tauri/",
      "dist/",
      "build/",
      "coverage/",
      "_output/",
      ".aiwcli/",
    ],
    linterOptions: {
      reportUnusedDisableDirectives: "warn",
    },
  },

  // ── Base: type-aware TypeScript ──
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.ts"],
  })),
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "playwright.config.ts",
            "tests/e2e/convention-select.spec.ts",
            "tests/e2e/dds-browser.spec.ts",
            "tests/e2e/game-lifecycle.spec.ts",
            "tests/e2e/play-phase.spec.ts",
            "tests/e2e/stayman-bidding.spec.ts",
            "vite.config.ts",
            "vitest.config.ts",
          ],
        },
      },
    },
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
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

      // Type-aware rules
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",

      // Convention enforcement
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message: "Named exports only — no export default (CLAUDE.md)",
        },
        {
          selector: "TSEnumDeclaration[const=true]",
          message:
            "const enum breaks Vite/isolatedModules — use regular enum (CLAUDE.md)",
        },
      ],
      eqeqeq: ["error", "always"],
    },
  },

  // ── Svelte store files (.svelte.ts) — unbound-method is expected ──
  {
    files: ["**/*.svelte.ts"],
    rules: {
      "@typescript-eslint/unbound-method": "off",
    },
  },

  // ── CLI files — console is expected ──
  {
    files: ["src/cli/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },

  // ── Module boundary: engine/ ──
  {
    files: ["src/engine/**/*.ts"],
    ignores: [
      "src/engine/__tests__/**",
      "src/engine/**/*.test.ts",
      "src/engine/tauri-ipc-engine.ts",
      "src/engine/wasm-engine.ts",
      "src/engine/dds-client.ts",
      "src/engine/dds-worker.ts",
      "src/engine/bid-suggester.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...svelteImports,
            ...storeImports,
            ...componentImports,
            ...strategyImports,
            {
              name: "../core/display/*",
              message: "engine/ must not import display/",
            },
            {
              name: "../../core/display/*",
              message: "engine/ must not import display/",
            },
            { name: "../bootstrap/*", message: "engine/ must not import bootstrap/" },
            {
              name: "../../bootstrap/*",
              message: "engine/ must not import bootstrap/",
            },
            {
              name: "../inference/*",
              message: "engine/ must not import inference/",
            },
            {
              name: "../../inference/*",
              message: "engine/ must not import inference/",
            },
            {
              name: "../teaching/*",
              message: "engine/ must not import teaching/",
            },
            {
              name: "../../teaching/*",
              message: "engine/ must not import teaching/",
            },
          ],
        },
      ],
    },
  },

  // ── Module boundary: core/contracts/ ──
  {
    files: ["src/core/contracts/**/*.ts"],
    ignores: ["src/core/contracts/__tests__/**", "src/core/contracts/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...svelteImports,
            ...storeImports,
            ...componentImports,
            ...strategyImports,
            {
              name: "../../conventions/*",
              message: "contracts/ must not import conventions/",
            },
            {
              name: "../../../conventions/*",
              message: "contracts/ must not import conventions/",
            },
            {
              name: "../display/*",
              message: "contracts/ must not import display/",
            },
            {
              name: "../../display/*",
              message: "contracts/ must not import display/",
            },
            { name: "../../bootstrap/*", message: "contracts/ must not import bootstrap/" },
            {
              name: "../../../bootstrap/*",
              message: "contracts/ must not import bootstrap/",
            },
            {
              name: "../../inference/*",
              message: "contracts/ must not import inference/",
            },
            {
              name: "../../../inference/*",
              message: "contracts/ must not import inference/",
            },
            {
              name: "../../teaching/*",
              message: "contracts/ must not import teaching/",
            },
            {
              name: "../../../teaching/*",
              message: "contracts/ must not import teaching/",
            },
          ],
        },
      ],
    },
  },

  // ── Module boundary: core/util/ (zero deps) ──
  {
    files: ["src/core/util/**/*.ts"],
    ignores: ["src/core/util/__tests__/**", "src/core/util/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*"],
              message: "util/ must have zero internal dependencies",
            },
          ],
        },
      ],
    },
  },

  // ── Module boundary: conventions/ ──
  {
    files: ["src/conventions/**/*.ts"],
    ignores: [
      "src/conventions/__tests__/**",
      "src/conventions/**/*.test.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...svelteImports,
            ...storeImports,
            ...componentImports,
            ...strategyImports,
            {
              name: "../core/display/*",
              message: "conventions/ must not import display/",
            },
            {
              name: "../../core/display/*",
              message: "conventions/ must not import display/",
            },
            {
              name: "../bootstrap/*",
              message: "conventions/ must not import bootstrap/",
            },
            {
              name: "../../bootstrap/*",
              message: "conventions/ must not import bootstrap/",
            },
            {
              name: "../teaching/*",
              message: "conventions/ must not import teaching/",
            },
            {
              name: "../../teaching/*",
              message: "conventions/ must not import teaching/",
            },
          ],
        },
      ],
    },
  },

  // ── Module boundary: core/display/ ──
  {
    files: ["src/core/display/**/*.ts"],
    ignores: ["src/core/display/__tests__/**", "src/core/display/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...svelteImports,
            ...storeImports,
            ...componentImports,
            ...strategyImports,
            {
              name: "../../bootstrap/*",
              message: "display/ must not import bootstrap/",
            },
            {
              name: "../../../bootstrap/*",
              message: "display/ must not import bootstrap/",
            },
            {
              name: "../../inference/*",
              message: "display/ must not import inference/",
            },
            {
              name: "../../../inference/*",
              message: "display/ must not import inference/",
            },
            {
              name: "../../teaching/*",
              message: "display/ must not import teaching/",
            },
            {
              name: "../../../teaching/*",
              message: "display/ must not import teaching/",
            },
          ],
          patterns: [{
            group: ["*/conventions/core/*", "*/conventions/core/conditions/*",
                    "*/conventions/core/dialogue/*", "*/conventions/core/intent/*"],
            message: "Import from 'conventions/core' barrel instead of deep paths",
          }],
        },
      ],
    },
  },

  // ── Module boundary: teaching/ ──
  {
    files: ["src/teaching/**/*.ts"],
    ignores: ["src/teaching/__tests__/**", "src/teaching/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...svelteImports,
            ...storeImports,
            ...componentImports,
            ...strategyImports,
            {
              name: "../core/display/*",
              message: "teaching/ must not import display/",
            },
            {
              name: "../../core/display/*",
              message: "teaching/ must not import display/",
            },
            {
              name: "../bootstrap/*",
              message: "teaching/ must not import bootstrap/",
            },
            {
              name: "../../bootstrap/*",
              message: "teaching/ must not import bootstrap/",
            },
            {
              name: "../inference/*",
              message: "teaching/ must not import inference/",
            },
            {
              name: "../../inference/*",
              message: "teaching/ must not import inference/",
            },
          ],
          patterns: [{
            group: ["*/conventions/core/*", "*/conventions/core/conditions/*",
                    "*/conventions/core/dialogue/*", "*/conventions/core/intent/*"],
            message: "Import from 'conventions/core' barrel instead of deep paths",
          }],
        },
      ],
    },
  },

  // ── Barrel enforcement: conventions/core/ ──
  {
    files: [
      "src/strategy/**/*.ts", "src/inference/**/*.ts", "src/bootstrap/**/*.ts",
      "src/stores/**/*.ts", "src/stores/**/*.svelte.ts",
      "src/components/**/*.ts", "src/components/**/*.svelte",
      "src/engine/**/*.ts",
    ],
    ignores: ["**/__tests__/**", "**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["*/conventions/core/*", "*/conventions/core/conditions/*",
                  "*/conventions/core/dialogue/*", "*/conventions/core/intent/*"],
          message: "Import from 'conventions/core' barrel instead of deep paths",
        }],
      }],
    },
  },

  // ── Module boundary: test-support/ ──
  {
    files: ["src/test-support/**/*.ts"],
    ignores: [
      "src/test-support/__tests__/**",
      "src/test-support/**/*.test.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...storeImports,
            ...componentImports,
            ...strategyImports,
            {
              name: "../conventions/*",
              message: "test-support/ must not import conventions/",
            },
            {
              name: "../../conventions/*",
              message: "test-support/ must not import conventions/",
            },
            {
              name: "../core/display/*",
              message: "test-support/ must not import display/",
            },
            {
              name: "../../core/display/*",
              message: "test-support/ must not import display/",
            },
            {
              name: "../inference/*",
              message: "test-support/ must not import inference/",
            },
            {
              name: "../../inference/*",
              message: "test-support/ must not import inference/",
            },
            {
              name: "../teaching/*",
              message: "test-support/ must not import teaching/",
            },
            {
              name: "../../teaching/*",
              message: "test-support/ must not import teaching/",
            },
          ],
        },
      ],
    },
  },

  // ── Test file relaxations ──
  {
    files: [
      "**/__tests__/**/*.ts",
      "**/*.test.ts",
      "**/*.spec.ts",
      "src/test-support/**/*.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/require-await": "off",
      "no-restricted-imports": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/await-thenable": "off",
    },
  },

  // ── Root config files — relaxed rules ──
  {
    files: [
      "vite.config.ts",
      "vitest.config.ts",
      "playwright.config.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
      "no-restricted-imports": "off",
      "no-console": "off",
    },
  },

  // ── Svelte files ──
  ...sveltePlugin.configs["flat/recommended"].map((config) => ({
    ...config,
    files: ["**/*.svelte"],
    languageOptions: {
      ...config.languageOptions,
      parser: svelteParser,
      parserOptions: {
        ...config.languageOptions?.parserOptions,
        parser: tseslint.parser,
      },
    },
    plugins: {
      ...config.plugins,
      "unused-imports": unusedImports,
    },
    rules: {
      ...config.rules,
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": UNUSED_IMPORTS_VAR_RULE,
      "svelte/require-each-key": "error",
      eqeqeq: ["error", "always"],
      "no-console": "warn",
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message: "Named exports only — no export default (CLAUDE.md)",
        },
      ],
    },
  })),
);
