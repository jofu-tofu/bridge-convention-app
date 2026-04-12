/**
 * Pure helpers for the logged-in landing page.
 *
 * The landing page lives on the prerendered (content) route, where the WASM
 * service is not initialized. These helpers read localStorage directly and
 * format ids for display without calling into the service layer.
 */

const LAST_CONVENTION_KEY = "bridge-app:last-convention";
const PREFS_KEY = "bridge-app:practice-preferences";
const CUSTOM_SYSTEMS_KEY = "bridge-app:custom-systems";
const PRACTICE_PACKS_KEY = "bridge-app:practice-packs";

const CONVENTION_DISPLAY_NAMES: Record<string, string> = {
  "nt-bundle": "1NT Responses",
  "nt-stayman": "Stayman",
  "nt-transfers": "Jacoby Transfers",
  "bergen-bundle": "Bergen Raises",
  "weak-twos-bundle": "Weak Twos",
  "dont-bundle": "DONT",
  "michaels-unusual-bundle": "Michaels & Unusual",
  "strong-2c-bundle": "Strong 2♣",
  "negative-doubles-bundle": "Negative Doubles",
  "nmf-bundle": "New Minor Forcing",
};

const SYSTEM_DISPLAY_NAMES: Record<string, string> = {
  sayc: "SAYC",
  "2-over-1": "2/1",
  acol: "Acol",
};

const PRACTICE_MODE_LABELS: Record<string, string> = {
  "decision-drill": "Drill",
  "full-auction": "Full Auction",
  learn: "Learn",
};

export function displayConventionId(id: string): string {
  return (
    CONVENTION_DISPLAY_NAMES[id] ??
    id
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

export function displaySystemId(id: string | null | undefined): string {
  if (!id) return "";
  if (id.startsWith("custom:")) return "Custom";
  return SYSTEM_DISPLAY_NAMES[id] ?? id.toUpperCase();
}

export function displayPracticeMode(mode: string | null | undefined): string {
  if (!mode) return "Drill";
  return PRACTICE_MODE_LABELS[mode] ?? mode;
}

export function readLastConventionId(): string | null {
  try {
    return localStorage.getItem(LAST_CONVENTION_KEY);
  } catch {
    return null;
  }
}

export function clearLastConventionId(): void {
  try {
    localStorage.removeItem(LAST_CONVENTION_KEY);
  } catch {
    /* ignore */
  }
}

interface StoredPrefs {
  baseSystemId?: string;
  drill?: { practiceMode?: string };
}

export function readPrefs(): StoredPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return parsed as StoredPrefs;
    return {};
  } catch {
    return {};
  }
}

export interface LandingCustomSystem {
  id: string;
  name: string;
}

export function readCustomSystems(): LandingCustomSystem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SYSTEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { systems?: unknown };
    if (!parsed || !Array.isArray(parsed.systems)) return [];
    return (parsed.systems as Array<Record<string, unknown>>)
      .filter((s) => typeof s.id === "string" && typeof s.name === "string")
      .map((s) => ({ id: s.id as string, name: s.name as string }));
  } catch {
    return [];
  }
}

export interface LandingPracticePack {
  id: string;
  name: string;
}

export function readPracticePacks(): LandingPracticePack[] {
  try {
    const raw = localStorage.getItem(PRACTICE_PACKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { packs?: unknown };
    if (!parsed || !Array.isArray(parsed.packs)) return [];
    return (parsed.packs as Array<Record<string, unknown>>)
      .filter((p) => typeof p.id === "string" && typeof p.name === "string")
      .map((p) => ({ id: p.id as string, name: p.name as string }));
  } catch {
    return [];
  }
}
