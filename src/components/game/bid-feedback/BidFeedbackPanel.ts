/**
 * BidFeedbackPanel display helpers.
 *
 * Convention-agnostic pure functions for rendering TeachingProjection data.
 * All rendering decisions are driven by the TeachingProjection contract shape,
 * not by convention-specific checks.
 */

import type { EncoderKind } from "../../../conventions";

/** Human-readable ambiguity description. Returns null when score is 0 (clear-cut). */
export function formatAmbiguity(score: number): string | null {
  if (score === 0) return null;
  if (score <= 0.3) return "Close call";
  if (score <= 0.6) return "Other reasonable bids exist";
  return "Several bids could work here";
}

/** Map elimination stage identifiers to readable labels for teaching context. */
export function formatEliminationStage(stage: string): string {
  switch (stage) {
    case "activation":
      return "This convention doesn't apply here";
    case "applicability":
      return "Your hand doesn't fit this bid";
    case "encoding":
      return "Can't be bid in this auction";
    case "legality":
      return "Not a legal bid here";
    case "arbitration":
      return "A better bid takes priority";
    default:
      return stage;
  }
}

/** Map module roles to display strings. */
export function formatModuleRole(role: "primary" | "alternative" | "suppressed"): string {
  switch (role) {
    case "primary":
      return "Selected";
    case "alternative":
      return "Alternative";
    case "suppressed":
      return "Not active";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

/** Tailwind classes for module role badges. */
export function roleColorClasses(role: "primary" | "alternative" | "suppressed"): string {
  switch (role) {
    case "primary":
      return "bg-green-900/70 border-green-500/40 text-green-200";
    case "alternative":
      return "bg-sky-900/70 border-sky-500/40 text-sky-200";
    case "suppressed":
      return "bg-zinc-800/70 border-zinc-500/40 text-zinc-400";
  }
}

/** Tailwind classes for WhyNot grade badges. */
export function whyNotGradeClasses(grade: "near-miss" | "wrong"): {
  badge: string;
  label: string;
} {
  switch (grade) {
    case "near-miss":
      return {
        badge: "bg-amber-900/70 border-amber-500/40 text-amber-200",
        label: "Close",
      };
    case "wrong":
      return {
        badge: "bg-red-900/70 border-red-500/40 text-red-300",
        label: "Doesn't fit",
      };
  }
}

/** Whether an encoder kind represents an artificial/non-obvious encoding worth explaining. */
export function isArtificialEncoder(kind: EncoderKind): boolean {
  return kind === "frontier-step" || kind === "relay-map" || kind === "alternate-encoding";
}

/** Human-readable description of how a meaning was encoded into a concrete call.
 *  Returns null for trivial encodings (default-call, direct resolver) that don't
 *  need pedagogical explanation. Convention-agnostic: driven by EncoderKind metadata. */
export function formatEncoderKind(kind: EncoderKind): string | null {
  switch (kind) {
    case "frontier-step":
      return "This is a relay step — an artificial bid that's part of a convention sequence";
    case "relay-map":
      return "This bid is remapped by the convention — it doesn't carry its usual meaning";
    case "alternate-encoding":
      return "This bid uses a different encoding because of the auction so far";
    case "default-call":
    case "resolver":
      return null;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
