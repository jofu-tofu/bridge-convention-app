/**
 * Shared reactive breakpoints derived from viewport width.
 *
 * Usage in a Svelte 5 component:
 *   let innerW = $state(1024);
 *   const bp = createBreakpoints(() => innerW);
 *   // bp.isDesktop, bp.isTablet, bp.isMobile are all reactive
 */

/** Breakpoint thresholds (px). Exported for unit tests. */
export const DESKTOP_MIN = 1024;
export const TABLET_MIN = 640;

export function createBreakpoints(width: () => number) {
  const isDesktop = $derived(width() >= DESKTOP_MIN);
  const isTablet = $derived(width() >= TABLET_MIN && width() < DESKTOP_MIN);
  const isMobile = $derived(width() < TABLET_MIN);
  return {
    get isDesktop() { return isDesktop; },
    get isTablet() { return isTablet; },
    get isMobile() { return isMobile; },
  };
}
