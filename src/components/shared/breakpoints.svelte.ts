/**
 * Shared reactive breakpoints derived from viewport width.
 *
 * Classification logic:
 *   isDesktop: width >= DESKTOP_MIN
 *   isTablet:  TABLET_MIN <= width < DESKTOP_MIN
 *   isMobile:  width < TABLET_MIN
 */

/** Breakpoint thresholds (px). Exported for unit tests. */
export const DESKTOP_MIN = 1024;
export const TABLET_MIN = 640;
