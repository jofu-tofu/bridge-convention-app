import { FEATURES } from "../../stores/feature-flags";

export type NavClearAction = "selection" | "workshop";

export interface NavItem {
  href: string;
  label: string;
  /** Inner SVG markup (viewBox 0 0 24 24). Rendered with {@html}. Trusted static content. */
  iconSvg: string;
  /** Pathnames that should mark this item active. */
  activePaths: readonly string[];
  /** Store method to call on click in the app-side NavRail. Ignored in the static content nav. */
  clearAction?: NavClearAction;
}

const PRACTICE_ICON = '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>';
const LEARN_ICON = '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />';
const GUIDES_ICON = '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>';
const WORKSHOP_ICON = '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>';
const SETTINGS_ICON = '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>';

export function getNavItems(): NavItem[] {
  const items: NavItem[] = [
    { href: "/practice", label: "Practice", iconSvg: PRACTICE_ICON, activePaths: ["/practice", "/practice/drill", "/game"], clearAction: "selection" },
    { href: "/learn", label: "Learn", iconSvg: LEARN_ICON, activePaths: ["/learn", "/lessons", "/systems", "/coverage"] },
    { href: "/guides", label: "Guides", iconSvg: GUIDES_ICON, activePaths: ["/guides"] },
  ];
  if (FEATURES.workshop) {
    items.push({
      href: "/workshop",
      label: "Workshop",
      iconSvg: WORKSHOP_ICON,
      activePaths: ["/workshop", "/convention-editor", "/practice-pack-editor"],
      clearAction: "workshop",
    });
  }
  items.push({ href: "/settings", label: "Settings", iconSvg: SETTINGS_ICON, activePaths: ["/settings"] });
  return items;
}

export function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/guides") {
    return pathname === "/guides" || pathname.startsWith("/guides/");
  }
  if (item.href === "/practice") {
    return pathname === "/practice" || pathname.startsWith("/practice/") || pathname === "/game";
  }
  if (item.href === "/learn") {
    return pathname === "/learn" || pathname.startsWith("/learn/") || pathname === "/lessons" || pathname === "/systems" || pathname === "/coverage";
  }
  return item.activePaths.includes(pathname);
}
