import tseslint from "typescript-eslint";
import sveltePlugin from "eslint-plugin-svelte";
import svelteParser from "svelte-eslint-parser";
import unusedImports from "eslint-plugin-unused-imports";
import { rule as noFullScopeTrigger } from "./eslint-rules/no-full-scope-trigger.js";
import { rule as noHardcodedStyleClasses } from "./eslint-rules/no-hardcoded-style-classes.js";

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
const teachingImports = [
  {
    name: "../teaching/*",
    message: "Module boundary violation: no teaching imports",
  },
  {
    name: "../../teaching/*",
    message: "Module boundary violation: no teaching imports",
  },
  {
    name: "../../../teaching/*",
    message: "Module boundary violation: no teaching imports",
  },
];
const bootstrapImports = [
  {
    name: "../bootstrap/*",
    message: "Module boundary violation: no bootstrap imports",
  },
  {
    name: "../../bootstrap/*",
    message: "Module boundary violation: no bootstrap imports",
  },
  {
    name: "../../../bootstrap/*",
    message: "Module boundary violation: no bootstrap imports",
  },
];
const inferenceImports = [
  {
    name: "../inference/*",
    message: "Module boundary violation: no inference imports",
  },
  {
    name: "../../inference/*",
    message: "Module boundary violation: no inference imports",
  },
  {
    name: "../../../inference/*",
    message: "Module boundary violation: no inference imports",
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
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 25,
          allowDefaultProject: [
            "playwright.config.ts",
            "tests/e2e/alert-audit.spec.ts",
            "tests/e2e/convention-select.spec.ts",
            "tests/e2e/dds-browser.spec.ts",
            "tests/e2e/explore-home.spec.ts",
            "tests/e2e/flow-auction-complete.spec.ts",
            "tests/e2e/flow-details.spec.ts",
            "tests/e2e/flow-dont-bergen.spec.ts",
            "tests/e2e/flow-edge-cases.spec.ts",
            "tests/e2e/flow-multi-convention.spec.ts",
            "tests/e2e/flow-stayman.spec.ts",
            "tests/e2e/flow-test.spec.ts",
            "tests/e2e/game-lifecycle.spec.ts",
            "tests/e2e/my-review.spec.ts",
            "tests/e2e/play-phase.spec.ts",
            "tests/e2e/stayman-bidding.spec.ts",
            "tests/e2e/test-1nt-full.spec.ts",
            "tests/e2e/test-bergen.spec.ts",
            "tests/e2e/test-dont.spec.ts",
            "tests/e2e/test-transfers.spec.ts",
            "tests/e2e/test-weak-two.spec.ts",
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

  // ── Module boundary: cli/ ──
  {
    files: ["src/cli/**/*.ts"],
    ignores: ["src/cli/__tests__/**", "src/cli/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...svelteImports,
            ...storeImports,
            ...componentImports,
            ...strategyImports,
            ...teachingImports,
          ],
          patterns: [{
            group: ["*/conventions/core/pipeline/**", "*/conventions/core/runtime/**",
                      "*/conventions/core/bundle/**", "*/conventions/core/witness/**",
                      "*/conventions/core/context-factory",
                      "**/conventions/core/pipeline/**", "**/conventions/core/runtime/**",
                      "**/conventions/core/bundle/**", "**/conventions/core/witness/**",
                      "**/conventions/core/context-factory"],
            message: "Import from 'conventions/core' barrel instead of deep paths",
          }],
        },
      ],
    },
  },

  // ── Module boundary: components/ ──
  {
    files: ["src/components/**/*.svelte", "src/components/**/*.ts"],
    ignores: [
      "src/components/__tests__/**",
      "src/components/**/*.test.ts",
      "src/components/game/debug/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...strategyImports,
            ...teachingImports,
            ...inferenceImports,
          ],
          patterns: [{
            group: ["*/conventions/core/pipeline/**", "*/conventions/core/runtime/**",
                      "*/conventions/core/bundle/**", "*/conventions/core/witness/**",
                      "*/conventions/core/context-factory",
                      "**/conventions/core/pipeline/**", "**/conventions/core/runtime/**",
                      "**/conventions/core/bundle/**", "**/conventions/core/witness/**",
                      "**/conventions/core/context-factory"],
            message: "Import from 'conventions/core' barrel instead of deep paths",
          }],
        },
      ],
    },
  },

  // ── Viewport boundary enforcement: agent-facing CLI commands ──
  // eval.ts and play.ts must use the evaluation/ facade — no direct
  // access to strategy, teaching, viewport builders, or convention internals.
  {
    files: ["src/cli/commands/eval.ts", "src/cli/commands/play.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...svelteImports,
            ...storeImports,
            ...componentImports,
          ],
          patterns: [
            {
              group: ["**/strategy/**"],
              message: "Agent-facing commands must use evaluation/ facade, not strategy/ directly",
            },
            {
              group: ["**/teaching/**"],
              message: "Agent-facing commands must use evaluation/ facade, not teaching/ directly",
            },
            {
              group: ["**/conventions/**"],
              message: "Agent-facing commands must use evaluation/ facade, not conventions/ directly",
            },
            {
              group: ["**/core/viewport/**"],
              message: "Agent-facing commands must use evaluation/ facade, not core/viewport/ directly",
            },
            {
              group: ["**/core/contracts/**"],
              message: "Agent-facing commands must use evaluation/ facade, not core/contracts/ directly",
            },
            {
              group: ["**/engine/**"],
              message: "Agent-facing commands must use evaluation/ facade or cli/shared for engine types",
            },
          ],
        },
      ],
    },
  },

  // ── Module boundary: stores/ ──
  //
  // Service boundary — "never crosses" types (see service/response-types.ts):
  //   BLOCKED (error): ArbitrationResult, MeaningSurface, InferenceEngine
  //     — these have no store usage and must never leak across the boundary.
  //     InferenceEngine is also blocked by the inference/ directory restriction below.
  //
  //   TRANSITIONAL (not yet blocked — stores still reference these):
  //     Deal, DrillBundle — used by game/play stores (migrate to viewport types)
  //     BidResult, ConventionBiddingStrategy, StrategyEvaluation — used by
  //       bidding store's legacy evaluation path
  //     DrillSession — used by game store for session lifecycle
  //
  {
    files: ["src/stores/**/*.ts", "src/stores/**/*.svelte.ts"],
    ignores: ["src/stores/__tests__/**", "src/stores/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            // ── "Never crosses" type restrictions ──
            {
              name: "../core/contracts",
              importNames: ["ArbitrationResult", "MeaningSurface"],
              message: "Service boundary: this type should never cross into stores. See service/response-types.ts.",
            },
            {
              name: "../core/contracts/module-surface",
              importNames: ["ArbitrationResult"],
              message: "Service boundary: ArbitrationResult should never cross into stores. See service/response-types.ts.",
            },
            {
              name: "../core/contracts/convention-types",
              importNames: ["ArbitrationResult"],
              message: "Service boundary: ArbitrationResult should never cross into stores. See service/response-types.ts.",
            },
            {
              name: "../core/contracts/meaning",
              importNames: ["MeaningSurface"],
              message: "Service boundary: MeaningSurface should never cross into stores. See service/response-types.ts.",
            },
            ...componentImports,
            {
              name: "../cli/*",
              message: "stores/ must not import cli/",
            },
            {
              name: "../../cli/*",
              message: "stores/ must not import cli/",
            },
            {
              name: "../bootstrap/*",
              message: "stores must use service layer, not bootstrap directly",
            },
            {
              name: "../../bootstrap/*",
              message: "stores must use service layer, not bootstrap directly",
            },
            {
              name: "../conventions/*",
              message: "stores must use service layer, not conventions directly",
            },
            {
              name: "../../conventions/*",
              message: "stores must use service layer, not conventions directly",
            },
            {
              name: "../strategy/*",
              message: "stores must use service layer, not strategy directly",
            },
            {
              name: "../../strategy/*",
              message: "stores must use service layer, not strategy directly",
            },
            {
              name: "../teaching/*",
              message: "stores must use service layer, not teaching directly",
            },
            {
              name: "../../teaching/*",
              message: "stores must use service layer, not teaching directly",
            },
            {
              name: "../inference/*",
              message: "stores must use service layer, not inference directly",
            },
            {
              name: "../../inference/*",
              message: "stores must use service layer, not inference directly",
            },
            {
              name: "../core/viewport/*",
              message: "stores must use service layer for viewport construction",
            },
            {
              name: "../../core/viewport/*",
              message: "stores must use service layer for viewport construction",
            },
          ],
          patterns: [{
            group: ["*/conventions/core/pipeline/**", "*/conventions/core/runtime/**",
                      "*/conventions/core/bundle/**", "*/conventions/core/witness/**",
                      "**/conventions/core/pipeline/**", "**/conventions/core/runtime/**",
                      "**/conventions/core/bundle/**", "**/conventions/core/witness/**"],
            message: "Import from 'conventions/core' barrel instead of deep paths",
          }],
        },
      ],
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

  // ── Module isolation: convention modules must not import sibling modules ──
  // Enforces the "modules are portable building blocks" principle (CLAUDE.md).
  // Modules never import from other modules. Cross-module relationships emerge
  // from shared vocabulary tags, not explicit references to foreign IDs.
  // Allowed: conventions/core/, core/contracts/, engine/, pedagogical-vocabulary.
  // Blocked: sibling module directories and files within modules/.
  //
  // Concrete SystemConfig imports (SAYC_SYSTEM_CONFIG, TWO_OVER_ONE_SYSTEM_CONFIG)
  // are banned — modules must receive SystemConfig via factory parameter.
  {
    files: ["src/conventions/definitions/modules/**/*.ts"],
    ignores: ["**/__tests__/**", "**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "../../../core/contracts/system-config",
              importNames: ["SAYC_SYSTEM_CONFIG", "TWO_OVER_ONE_SYSTEM_CONFIG"],
              message: "Convention modules must receive SystemConfig via factory parameter, not import a concrete system config.",
            },
            {
              name: "../../../../core/contracts/system-config",
              importNames: ["SAYC_SYSTEM_CONFIG", "TWO_OVER_ONE_SYSTEM_CONFIG"],
              message: "Convention modules must receive SystemConfig via factory parameter, not import a concrete system config.",
            },
          ],
          patterns: [
            {
              // Block subdirectory modules importing sibling subdirectories
              // e.g., bergen/ importing from ../dont/ or ../weak-twos/
              group: ["../bergen", "../bergen/*", "../dont", "../dont/*",
                      "../weak-twos", "../weak-twos/*",
                      "../stayman", "../stayman-rules",
                      "../jacoby-transfers", "../jacoby-transfers-rules",
                      "../smolen", "../smolen-rules",
                      "../natural-nt", "../natural-nt-rules"],
              message: "Module isolation: convention modules must not import from sibling modules. " +
                "Cross-module relationships use shared vocabulary tags, not direct imports.",
            },
            {
              // Block top-level modules importing subdirectory modules
              // e.g., stayman.ts importing from ./bergen/ or ./dont/
              group: ["./bergen", "./bergen/*", "./dont", "./dont/*",
                      "./weak-twos", "./weak-twos/*"],
              message: "Module isolation: convention modules must not import from sibling modules. " +
                "Cross-module relationships use shared vocabulary tags, not direct imports.",
            },
          ],
        },
      ],
    },
  },

  // ── Protocol trigger scope: convention files ──
  {
    files: ["src/conventions/definitions/**/*.ts", "src/conventions/core/**/*.ts"],
    ignores: ["**/__tests__/**", "**/*.test.ts"],
    plugins: {
      local: { rules: { "no-full-scope-trigger": noFullScopeTrigger } },
    },
    rules: {
      "local/no-full-scope-trigger": "warn",
    },
  },

  // ── Design token enforcement: game screen components ──
  // Text-size tokens are fully migrated → error.
  // Raw color palette classes are not yet migrated → warn.
  {
    files: [
      "src/components/screens/game-screen/**/*.svelte",
      "src/components/game/**/*.svelte",
    ],
    ignores: [
      "src/components/game/debug/**",
      "src/components/game/Debug*.svelte",
      "src/components/game/DecisionTree.svelte",
    ],
    plugins: {
      local: { rules: { "no-hardcoded-style-classes": noHardcodedStyleClasses } },
    },
    rules: {
      "local/no-hardcoded-style-classes": ["error", { banTextSizes: true, banRawColors: false }],
    },
  },
  {
    files: [
      "src/components/screens/game-screen/**/*.svelte",
      "src/components/game/**/*.svelte",
    ],
    ignores: [
      "src/components/game/debug/**",
      "src/components/game/Debug*.svelte",
      "src/components/game/DecisionTree.svelte",
    ],
    plugins: {
      "local-colors": { rules: { "no-hardcoded-style-classes": noHardcodedStyleClasses } },
    },
    rules: {
      "local-colors/no-hardcoded-style-classes": ["error", { banTextSizes: false, banRawColors: true }],
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
            group: ["*/conventions/core/pipeline/**", "*/conventions/core/runtime/**",
                    "*/conventions/core/bundle/**", "*/conventions/core/witness/**",
                    "**/conventions/core/pipeline/**", "**/conventions/core/runtime/**",
                    "**/conventions/core/bundle/**", "**/conventions/core/witness/**"],
            message: "Import from 'conventions/core' barrel instead of deep paths",
          }],
        },
      ],
    },
  },

  // ── Module boundary: core/viewport/ ──
  {
    files: ["src/core/viewport/**/*.ts"],
    ignores: ["src/core/viewport/__tests__/**", "src/core/viewport/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...svelteImports,
            ...storeImports,
            ...componentImports,
            ...strategyImports,
            ...teachingImports,
            ...bootstrapImports,
            ...inferenceImports,
          ],
        },
      ],
    },
  },

  // ── Module boundary: inference/ ──
  {
    files: ["src/inference/**/*.ts"],
    ignores: ["src/inference/__tests__/**", "src/inference/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...svelteImports,
            ...storeImports,
            ...componentImports,
            ...strategyImports,
            ...teachingImports,
            ...bootstrapImports,
          ],
        },
      ],
    },
  },

  // ── Module boundary: strategy/ ──
  {
    files: ["src/strategy/**/*.ts"],
    ignores: ["src/strategy/__tests__/**", "src/strategy/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...svelteImports,
            ...storeImports,
            ...componentImports,
            ...bootstrapImports,
          ],
        },
      ],
    },
  },

  // ── Module boundary: bootstrap/ ──
  {
    files: ["src/bootstrap/**/*.ts"],
    ignores: ["src/bootstrap/__tests__/**", "src/bootstrap/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...svelteImports,
            ...storeImports,
            ...componentImports,
          ],
        },
      ],
    },
  },

  // ── Module boundary: service/ ──
  {
    files: ["src/service/**/*.ts"],
    ignores: ["src/service/__tests__/**", "src/service/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...svelteImports,
            ...storeImports,
            ...componentImports,
          ],
        },
      ],
    },
  },

  // ── Barrel enforcement: conventions/core/ ──
  {
    files: [
      "src/strategy/**/*.ts", "src/inference/**/*.ts", "src/bootstrap/**/*.ts",
      "src/components/**/*.ts", "src/components/**/*.svelte",
      "src/engine/**/*.ts",
    ],
    ignores: ["**/__tests__/**", "**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["*/conventions/core/pipeline/**", "*/conventions/core/runtime/**",
                    "*/conventions/core/bundle/**", "*/conventions/core/witness/**",
                    "**/conventions/core/pipeline/**", "**/conventions/core/runtime/**",
                    "**/conventions/core/bundle/**", "**/conventions/core/witness/**"],
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
