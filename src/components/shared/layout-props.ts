/**
 * Shared layout properties passed from GameScreen to each phase component.
 * Keeps responsive scaling logic centralized in GameScreen.
 */
export interface LayoutProps {
  tableScale: number;
  tableOrigin: string;
  tableBaseW: number;
  tableBaseH: number;
}

// Static responsive layout classes -- mobile-first with lg: desktop overrides.
// lg: (1024px) matches DESKTOP_MIN in breakpoints.svelte.ts.

/** 2-column phase layout: table + side panel (grid on desktop, stacked on mobile). */
export const PHASE_CONTAINER_CLASS =
  "flex-1 flex flex-col lg:grid lg:grid-cols-[1fr_var(--width-side-panel)] lg:grid-rows-[minmax(0,1fr)] lg:gap-3 overflow-hidden";

/** 3-column playing phase: history (narrow) | table | controls (grid on desktop, stacked on mobile). */
export const PLAYING_PHASE_CONTAINER_CLASS =
  "flex-1 flex flex-col lg:grid lg:grid-cols-[var(--width-play-history)_minmax(0,1fr)_var(--width-side-panel)] lg:grid-rows-[minmax(0,1fr)] lg:gap-3 overflow-hidden";

/** Shared panel font-size inline style derived from GameScreen's `--panel-font` custom property. */
export const PANEL_FONT_STYLE = "font-size: var(--panel-font, 1rem);";

/** Side panel: stacked with top border on mobile, grid-child with full height on desktop. */
export const SIDE_PANEL_CLASS =
  "flex-1 lg:flex-none border-t lg:border-t-0 border-border-subtle lg:h-full bg-bg-base p-3 flex flex-col min-h-0 overflow-hidden";
