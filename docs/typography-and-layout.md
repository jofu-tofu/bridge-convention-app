# Typography & Layout

## Single-Source Typography System

The game screen uses a **single-source typography system** so that card text, panel text, and table-interior text all scale from one computed base (`--panel-font`). This prevents font-size drift across viewports, orientations, and future features.

### How it works

1. **`--panel-font`** — GameScreen computes a px value from viewport width + table scale: `Math.max(12, round(rootFontSize * (0.5 + 0.5 * tableScale)))`. Set as a CSS variable on `<main>`.
2. **`--text-*` tokens** — em-relative CSS custom properties defined in `app.css :root`. They cascade from the local `font-size`, which is `--panel-font` in panels and a compensated value in the table.
3. **ScaledTableArea font compensation** — The CSS-transform container sets `font-size: calc(--panel-font / scale)`, so after the transform, text appears at `--panel-font` size on screen.
4. **Card text** — Uses `var(--text-value)` (1.2em), not a card-width ratio. Card rank/suit text matches panel `--text-value` in apparent size.
5. **Z-index hierarchy** — `--z-header` (10), `--z-tooltip` (20), `--z-overlay` (30), `--z-modal` (40), `--z-above-all` (50). Use `z-[--z-header]` instead of `z-10`.

### Token Scale

All em-relative, defined in `app.css`:

| Token | Value | Purpose |
|---|---|---|
| `--text-annotation` | 0.65em | Tiny: alert annotations on bids |
| `--text-label` | 0.75em | Section headings, muted labels |
| `--text-detail` | 0.85em | Secondary info, seat labels |
| `--text-body` | 1em | Primary readable content (= parent font) |
| `--text-value` | 1.2em | Prominent: card rank/suit, contract, trick count |
| `--text-heading` | 1.35em | Sub-section headings |
| `--text-title` | 1.6em | Screen titles, hero text |

### Rules

- **Game screen components MUST use `--text-*` tokens** (via `text-[--text-label]` Tailwind syntax or `font-size: var(--text-label)`) instead of hardcoded `text-xs` / `text-sm` / `text-base`. **Enforced by ESLint**.
- **Raw Tailwind color-palette classes** (e.g. `text-red-400`, `bg-green-600`) are **banned** in game components. Use `--color-*` tokens from `app.css @theme`.
- **Non-game screens** may use standard Tailwind text classes for now.
- **TypeScript typing:** `TextToken` type and `TEXT_TOKEN_CLASS` map in `src/components/shared/tokens.ts`.
- **Do NOT add new hardcoded px font-sizes** to game components.
- **Border-radius:** Use `rounded-[--radius-sm]` etc. instead of raw Tailwind classes. `rounded-full` is allowed.
- **ESLint rule:** `eslint-rules/no-hardcoded-style-classes.js` — bans hardcoded text-size, raw color-palette, z-index, and border-radius classes in game components.

## Accessibility

- **Semantic landmarks.** Screen components use `<main>`, `<header>`, `<section>` with headings.
- **ARIA labels on display elements.** Face-up cards: `aria-label="{rank} of {suit}"`, face-down: `aria-label="Card back"`.
- **Live regions for dynamic content.** `aria-live="polite"` on updating content, `role="alert"` for immediate feedback.
- **Decorative elements hidden.** SVG icons use `aria-hidden="true"`.
- **Native semantics first.** Prefer `<button>`, `<table>`, `<input>` over `<div>` with ARIA roles. Semantic tables use `<caption class="sr-only">`.
