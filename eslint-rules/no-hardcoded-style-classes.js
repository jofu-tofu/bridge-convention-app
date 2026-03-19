/**
 * ESLint rule: no-hardcoded-style-classes
 *
 * Bans raw Tailwind text-size, color-palette, z-index, and border-radius
 * classes in components.  These should use the global design token system
 * instead (--text-*, --color-*, --z-*, --radius-* in app.css @theme).
 *
 * Four independent checks, each separately configurable:
 *   1. banTextSizes    — bans text-xs … text-3xl and arbitrary text-[Npx].
 *   2. banRawColors    — bans raw Tailwind palette colors (text-red-400, …).
 *   3. banRawZIndex    — bans z-10 … z-50 (use z-[--z-header] etc.).
 *   4. banRawRadius    — bans rounded-sm/md/lg/xl/2xl (use rounded-[--radius-*]).
 *                         rounded-full is allowed (it's a shape, not a radius).
 *
 * Usage in eslint.config.js:
 *
 *   "local/no-hardcoded-style-classes": ["error", {
 *     banTextSizes: true,
 *     banRawColors: true,
 *     banRawZIndex: true,
 *     banRawRadius: true,
 *   }]
 */

// Tailwind size keywords that should be replaced with --text-* tokens
const TEXT_SIZE_PATTERN =
  /\btext-(xs|sm|base|lg|xl|2xl|3xl)\b/;

// Arbitrary pixel / em sizes like text-[10px], text-[1.2em]
const TEXT_ARBITRARY_SIZE_PATTERN =
  /\btext-\[\d+(\.\d+)?(px|em|rem)\]/;

// Raw Tailwind palette colors — matches the start of any
// utility-palette-shade class like text-red-400, bg-blue-600/50, etc.
const PALETTE_NAMES = [
  "red", "orange", "amber", "yellow", "lime", "green", "emerald",
  "teal", "cyan", "sky", "blue", "indigo", "violet", "purple",
  "fuchsia", "pink", "rose", "slate", "gray", "zinc", "neutral", "stone",
].join("|");

const RAW_COLOR_PATTERN = new RegExp(
  `\\b(?:text|bg|border|ring|shadow|from|to|via|outline|decoration|divide|placeholder|caret|accent|fill|stroke)-(?:${PALETTE_NAMES})-\\d`,
);

// Raw z-index: z-10, z-20, z-30, z-40, z-50 (but not z-0 or z-auto)
const RAW_Z_INDEX_PATTERN = /\bz-\d+\b/;

// Raw border-radius: rounded-sm, rounded-md, rounded-lg, rounded-xl, rounded-2xl
// (rounded-full is allowed — it's a shape, not a configurable radius)
const RAW_RADIUS_PATTERN = /\brounded-(sm|md|lg|xl|2xl)\b/;

/**
 * Extract the raw string value from an AST node depending on its type.
 * Returns null when the node type is not a string-like value.
 */
function extractStringValue(node) {
  if (!node) return null;
  // Regular JS string literal
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  // Svelte template text (inside attributes)
  if (node.type === "SvelteLiteral" && typeof node.value === "string") {
    return node.value;
  }
  // Template literal quasi (backtick string fragment)
  if (node.type === "TemplateElement" && node.value) {
    return node.value.raw;
  }
  return null;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Ban hardcoded Tailwind text-size and raw color-palette classes. " +
        "Use --text-* typography tokens and --color-* design tokens instead.",
    },
    messages: {
      bannedTextSize:
        'Hardcoded text-size class "{{ match }}" — use a --text-* ' +
        "token instead (e.g. text-[--text-label], text-[--text-detail], " +
        "text-[--text-body], text-[--text-value]).",
      bannedRawColor:
        'Raw Tailwind color class "{{ match }}" — use a --color-* ' +
        "design token from app.css @theme instead (e.g. text-text-primary, " +
        "bg-bg-card, text-accent-success).",
      bannedRawZIndex:
        'Raw z-index class "{{ match }}" — use a --z-* token instead ' +
        "(e.g. z-[--z-header], z-[--z-tooltip], z-[--z-overlay], " +
        "z-[--z-modal], z-[--z-above-all]).",
      bannedRawRadius:
        'Raw border-radius class "{{ match }}" — use a --radius-* token ' +
        "instead (e.g. rounded-[--radius-sm], rounded-[--radius-md], " +
        "rounded-[--radius-lg]). rounded-full is allowed.",
    },
    schema: [
      {
        type: "object",
        properties: {
          banTextSizes: { type: "boolean" },
          banRawColors: { type: "boolean" },
          banRawZIndex: { type: "boolean" },
          banRawRadius: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const opts = context.options[0] || {};
    const banTextSizes = opts.banTextSizes !== false; // default true
    const banRawColors = opts.banRawColors !== false; // default true
    const banRawZIndex = opts.banRawZIndex !== false; // default true
    const banRawRadius = opts.banRawRadius !== false; // default true

    /** Check a string value and report matches. */
    function check(node, value) {
      if (!value) return;

      if (banTextSizes) {
        const sizeMatch =
          value.match(TEXT_SIZE_PATTERN) ||
          value.match(TEXT_ARBITRARY_SIZE_PATTERN);
        if (sizeMatch) {
          context.report({
            node,
            messageId: "bannedTextSize",
            data: { match: sizeMatch[0] },
          });
        }
      }

      if (banRawColors) {
        const colorMatch = value.match(RAW_COLOR_PATTERN);
        if (colorMatch) {
          context.report({
            node,
            messageId: "bannedRawColor",
            data: { match: colorMatch[0] },
          });
        }
      }

      if (banRawZIndex) {
        const zMatch = value.match(RAW_Z_INDEX_PATTERN);
        if (zMatch) {
          context.report({
            node,
            messageId: "bannedRawZIndex",
            data: { match: zMatch[0] },
          });
        }
      }

      if (banRawRadius) {
        const radiusMatch = value.match(RAW_RADIUS_PATTERN);
        if (radiusMatch) {
          context.report({
            node,
            messageId: "bannedRawRadius",
            data: { match: radiusMatch[0] },
          });
        }
      }
    }

    return {
      // JS / TS string literals (catches expressions like {cond ? 'text-xs' : 'text-sm'})
      Literal(node) {
        const value = extractStringValue(node);
        if (value) check(node, value);
      },

      // Svelte template text (catches class="text-xs ...")
      SvelteLiteral(node) {
        const value = extractStringValue(node);
        if (value) check(node, value);
      },

      // Template literal fragments (catches `text-xs ${...}`)
      TemplateElement(node) {
        const value = extractStringValue(node);
        if (value) check(node, value);
      },
    };
  },
};

export { rule };
