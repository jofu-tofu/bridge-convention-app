/**
 * Pure logic companion for StrengthBar.svelte.
 * Zone definitions and percentage math for the horizontal strength bar.
 */

export type Zone = "weak" | "invite" | "game" | "slam";

/** Background + text classes per zone. Complete literal strings for Tailwind JIT. */
export const ZONE_BG: Record<Zone, string> = {
  weak: "bg-text-muted/10",
  invite: "bg-amber-500/25",
  game: "bg-emerald-500/20",
  slam: "bg-blue-500/20",
};

export const ZONE_TEXT: Record<Zone, string> = {
  weak: "text-text-muted",
  invite: "text-amber-400",
  game: "text-emerald-400",
  slam: "text-blue-400",
};

export const ZONE_BORDER: Record<Zone, string> = {
  weak: "border-text-muted/20",
  invite: "border-amber-500/40",
  game: "border-emerald-500/40",
  slam: "border-blue-500/40",
};

/** Scale max for display — percentages are clamped to this range. */
const SCALE_MAX = 25;

/** Convert a threshold value to a percentage position (0–100). */
export function thresholdPct(value: number): number {
  return Math.min(100, Math.max(0, (value / SCALE_MAX) * 100));
}
