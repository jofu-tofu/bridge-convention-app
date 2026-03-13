/**
 * Bergen Raises meaning surfaces.
 *
 * Each surface represents a Bergen raise category. Surfaces are evaluated
 * in priority order: the first matching surface determines the raise type.
 *
 * Priority order (highest to lowest):
 *   1. Splinter (12+ HCP, 4-card support, shortage)
 *   2. Game raise (13+ HCP, 4-card support)
 *   3. Limit raise (10-12 HCP, 4-card support)
 *   4. Constructive raise (7-10 HCP, 4-card support)
 *   5. Preemptive raise (0-6 HCP, 4-card support)
 */

import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import type { BergenFacts } from "./facts";

/** Bergen raise surface identifier. */
export type BergenSurfaceId =
  | "splinter"
  | "game-raise"
  | "limit-raise"
  | "constructive-raise"
  | "preemptive-raise";

/** A Bergen raise surface with match predicate and call generator. */
export interface BergenSurface {
  readonly id: BergenSurfaceId;
  readonly label: string;
  readonly matches: (facts: BergenFacts) => boolean;
  readonly call: (facts: BergenFacts) => Call;
}

const pass: Call = { type: "pass" };

function otherMajor(suit: BidSuit.Hearts | BidSuit.Spades): BidSuit.Hearts | BidSuit.Spades {
  return suit === BidSuit.Hearts ? BidSuit.Spades : BidSuit.Hearts;
}

/**
 * All Bergen surfaces in evaluation priority order.
 *
 * Splinter MUST be first: a hand with 12+ HCP, 4-card support, AND
 * shortage qualifies for splinter, not a plain game/limit raise. The
 * shortage signals distributional strength that makes slam exploration
 * more valuable than a direct game bid. Without this priority, 13 HCP
 * hands with shortage would incorrectly match game-raise (13+ HCP)
 * and 12 HCP hands with shortage would match limit-raise (10-12 HCP).
 */
export const BERGEN_SURFACES: readonly BergenSurface[] = [
  {
    id: "splinter",
    label: "Splinter raise (12+ HCP with shortage)",
    matches: (facts) =>
      facts.hcp >= 12 &&
      facts.supportCount === 4 &&
      facts.hasShortage,
    call: (facts) =>
      facts.trumpSuit
        ? { type: "bid", level: 3, strain: otherMajor(facts.trumpSuit) }
        : pass,
  },
  {
    id: "game-raise",
    label: "Game raise (13+ HCP)",
    matches: (facts) =>
      facts.hcp >= 13 &&
      facts.supportCount === 4,
    call: (facts) =>
      facts.trumpSuit
        ? { type: "bid", level: 4, strain: facts.trumpSuit }
        : pass,
  },
  {
    id: "limit-raise",
    label: "Limit raise (10-12 HCP)",
    matches: (facts) =>
      facts.hcp >= 10 &&
      facts.hcp <= 12 &&
      facts.supportCount === 4,
    call: () => ({ type: "bid", level: 3, strain: BidSuit.Diamonds }),
  },
  {
    id: "constructive-raise",
    label: "Constructive raise (7-10 HCP)",
    matches: (facts) =>
      facts.hcp >= 7 &&
      facts.hcp <= 10 &&
      facts.supportCount === 4,
    call: () => ({ type: "bid", level: 3, strain: BidSuit.Clubs }),
  },
  {
    id: "preemptive-raise",
    label: "Preemptive raise (0-6 HCP)",
    matches: (facts) =>
      facts.hcp <= 6 &&
      facts.supportCount === 4,
    call: (facts) =>
      facts.trumpSuit
        ? { type: "bid", level: 3, strain: facts.trumpSuit }
        : pass,
  },
];

/**
 * Evaluate Bergen surfaces against facts and return the first matching surface.
 *
 * Surfaces are tested in priority order. The first surface whose `matches`
 * predicate returns true wins. Returns null if no surface matches (e.g.,
 * hand lacks 4-card support).
 */
export function evaluateBergenSurfaces(
  facts: BergenFacts,
): { surface: BergenSurface; call: Call } | null {
  for (const surface of BERGEN_SURFACES) {
    if (surface.matches(facts)) {
      return { surface, call: surface.call(facts) };
    }
  }
  return null;
}
