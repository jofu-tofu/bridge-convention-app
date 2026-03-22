/**
 * normalizeIntent — translates convention-shaped sourceIntent into canonical observations.
 *
 * This is a migration bridge. Modules currently author `sourceIntent` strings
 * ("StaymanAsk", "DONTRevealClubs"). This function normalizes them into bridge-universal
 * `BidAction[]` ("inquire(majorSuit)", "show(heldSuit, clubs)").
 *
 * Once modules emit observations directly (Phase 6 of the redesign), this layer
 * becomes unnecessary.
 *
 * Unknown intents return `[]` (graceful degradation). The exhaustiveness coverage
 * test in `__tests__/normalize-intent.test.ts` catches drift when new surfaces are added.
 */

import type {
  BidAction,
  ObsSuit,
  BidSuitName,
} from "../../core/contracts/bid-action";

// ── Types ──────────────────────────────────────────────────────────

interface SourceIntent {
  readonly type: string;
  readonly params: Readonly<Record<string, string | number | boolean>>;
}

type IntentMapper = (params: Readonly<Record<string, string | number | boolean>>) => readonly BidAction[];

// ── Helpers ────────────────────────────────────────────────────────

function otherMajor(suit: string): ObsSuit {
  return suit === "hearts" ? "spades" : "hearts";
}

function suit(params: Readonly<Record<string, string | number | boolean>>): ObsSuit {
  return params.suit as ObsSuit;
}

function strain(params: Readonly<Record<string, string | number | boolean>>): BidSuitName {
  return params.suit as BidSuitName;
}

// ── Mapping table ──────────────────────────────────────────────────

const INTENT_MAP: ReadonlyMap<string, IntentMapper> = new Map<string, IntentMapper>([
  // ── Natural NT ───────────────────────────────────────────────────
  ["NTOpening", () => [{ act: "open", strain: "notrump" }]],
  ["NTInvite", () => [{ act: "raise", strain: "notrump", strength: "invitational" }]],
  ["NTGame", () => [{ act: "raise", strain: "notrump", strength: "game" }]],
  ["TerminalPass", () => [{ act: "pass" }]],

  // ── Stayman ──────────────────────────────────────────────────────
  ["StaymanAsk", () => [{ act: "inquire", feature: "majorSuit" }]],
  ["ShowHeldSuit", (p) => [{ act: "show", feature: "heldSuit", suit: suit(p) }]],
  ["DenyMajor", () => [{ act: "deny", feature: "majorSuit" }]],
  ["RaiseGame", (p) => [{ act: "raise", strain: strain(p), strength: "game" }]],
  ["RaiseInvite", (p) => [{ act: "raise", strain: strain(p), strength: "invitational" }]],
  ["StaymanNTGame", () => [{ act: "place", strain: "notrump" }]],
  ["StaymanNTInvite", () => [{ act: "raise", strain: "notrump", strength: "invitational" }]],
  ["RedoubleStrength", () => [{ act: "redouble", feature: "strength" }]],

  // ── Jacoby Transfers ─────────────────────────────────────────────
  ["TransferToHearts", () => [{ act: "transfer", targetSuit: "hearts" }]],
  ["TransferToSpades", () => [{ act: "transfer", targetSuit: "spades" }]],
  ["AcceptTransfer", (p) => [{ act: "accept", feature: "heldSuit", suit: suit(p) }]],
  ["Signoff", (p) => [{ act: "signoff", strain: strain(p) }]],
  ["GameInMajor", (p) => [{ act: "raise", strain: strain(p), strength: "game" }]],
  ["TransferNTGame", () => [{ act: "place", strain: "notrump" }]],
  ["Invite", (p) => [{ act: "raise", strain: strain(p), strength: "invitational" }]],
  ["AcceptInvite", () => [{ act: "accept", feature: "strength", strength: "invitational" }]],
  ["DeclineInvite", () => [{ act: "decline", feature: "strength" }]],
  ["PlacementCorrection", (p) => [{ act: "place", strain: strain(p) }]],
  ["PlacementPass", () => [{ act: "pass" }]],

  // ── Smolen ───────────────────────────────────────────────────────
  ["Smolen", (p) => [
    { act: "show", feature: "shortMajor", suit: otherMajor(p.longMajor as string) },
    { act: "force", level: "game" },
  ]],
  ["SmolenPlacement", (p) => [{ act: "place", strain: strain(p) }]],

  // ── Major Opening (stub for rule module phase transitions) ───────
  ["MajorOpen", (p) => [{ act: "open", strain: strain(p) }]],

  // ── Bergen ───────────────────────────────────────────────────────
  ["Splinter", (p) => [
    { act: "show", feature: "shortage", suit: suit(p) },
    { act: "raise", strain: strain(p), strength: "game" },
  ]],
  ["GameRaise", (p) => [{ act: "raise", strain: strain(p), strength: "game" }]],
  ["LimitRaise", (p) => [{ act: "raise", strain: strain(p), strength: "limit" }]],
  ["ConstructiveRaise", (p) => [{ act: "raise", strain: strain(p), strength: "constructive" }]],
  ["PreemptiveRaise", (p) => [{ act: "raise", strain: strain(p), strength: "preemptive" }]],
  ["AcceptInvitation", (p) => [{ act: "accept", feature: "strength", suit: suit(p), strength: "invitational" }]],
  ["DeclineInvitation", (p) => [{ act: "decline", feature: "strength", suit: suit(p) }]],
  ["RaiseToGame", (p) => [{ act: "raise", strain: strain(p), strength: "game" }]],
  ["AcceptPartnerDecision", () => [{ act: "pass" }]],

  // ── Natural 1NT response (Bergen alternative) ────────────────────
  ["NaturalNtResponse", () => [{ act: "place", strain: "notrump" }]],

  // ── Weak Twos ────────────────────────────────────────────────────
  ["WeakTwoOpen", (p) => [{ act: "open", strain: strain(p), strength: "weak" }]],
  ["OgustAsk", () => [{ act: "inquire", feature: "suitQuality" }]],
  ["InviteRaise", (p) => [{ act: "raise", strain: strain(p), strength: "invitational", feature: "heldSuit" }]],
  ["WeakPass", () => [{ act: "pass" }]],
  ["OgustSolid", () => [{ act: "show", feature: "suitQuality", quality: "solid" }]],
  ["OgustMinBad", () => [
    { act: "show", feature: "strength", strength: "minimum" },
    { act: "show", feature: "suitQuality", quality: "bad" },
  ]],
  ["OgustMinGood", () => [
    { act: "show", feature: "strength", strength: "minimum" },
    { act: "show", feature: "suitQuality", quality: "good" },
  ]],
  ["OgustMaxBad", () => [
    { act: "show", feature: "strength", strength: "maximum" },
    { act: "show", feature: "suitQuality", quality: "bad" },
  ]],
  ["OgustMaxGood", () => [
    { act: "show", feature: "strength", strength: "maximum" },
    { act: "show", feature: "suitQuality", quality: "good" },
  ]],
  ["PostOgustGame", (p) => [{ act: "raise", strain: strain(p), strength: "game" }]],
  ["PostOgust3NT", () => [{ act: "raise", strain: "notrump", strength: "game" }]],
  ["PostOgustSignoff", (p) => [{ act: "signoff", strain: strain(p) }]],
  ["PostOgustPass", () => [{ act: "pass" }]],

  // ── DONT ─────────────────────────────────────────────────────────
  ["DONTBothMajors", () => [
    { act: "overcall", feature: "twoSuited" },
    { act: "show", feature: "heldSuit", suit: "hearts" },
    { act: "show", feature: "heldSuit", suit: "spades" },
  ]],
  ["DONTDiamondsMajor", () => [
    { act: "overcall", feature: "twoSuited" },
    { act: "show", feature: "heldSuit", suit: "diamonds" },
  ]],
  ["DONTClubsHigher", () => [
    { act: "overcall", feature: "twoSuited" },
    { act: "show", feature: "heldSuit", suit: "clubs" },
  ]],
  ["DONTNaturalSpades", () => [{ act: "overcall", feature: "heldSuit", suit: "spades" }]],
  ["DONTSingleSuited", () => [{ act: "overcall", feature: "heldSuit" }]],
  ["DONTPass", () => [{ act: "pass" }]],
  ["DONTAcceptHearts", () => [{ act: "accept", feature: "heldSuit", suit: "hearts" }]],
  ["DONTPreferSpades", () => [{ act: "show", feature: "heldSuit", suit: "spades" }]],
  ["DONTEscapeClubs", () => [{ act: "show", feature: "heldSuit", suit: "clubs" }]],
  ["DONTEscapeDiamonds", () => [{ act: "show", feature: "heldSuit", suit: "diamonds" }]],
  ["DONTAcceptDiamonds", () => [{ act: "accept", feature: "heldSuit", suit: "diamonds" }]],
  ["DONTRelayAskMajor", () => [{ act: "inquire", feature: "majorSuit" }]],
  ["DONTAcceptClubs", () => [{ act: "accept", feature: "heldSuit", suit: "clubs" }]],
  ["DONTRelayAskHigher", () => [{ act: "inquire", feature: "heldSuit" }]],
  ["DONTAcceptSpades", () => [{ act: "accept", feature: "heldSuit", suit: "spades" }]],
  ["DONTAcceptSpadesFallback", () => [{ act: "accept", feature: "heldSuit", suit: "spades" }]],
  ["DONTForcedRelay", () => [{ act: "relay", forced: true }]],
  ["DONTRevealClubs", () => [{ act: "show", feature: "heldSuit", suit: "clubs" }]],
  ["DONTRevealDiamonds", () => [{ act: "show", feature: "heldSuit", suit: "diamonds" }]],
  ["DONTRevealHearts", () => [{ act: "show", feature: "heldSuit", suit: "hearts" }]],
  ["DONTShowDiamonds", () => [{ act: "show", feature: "heldSuit", suit: "diamonds" }]],
  ["DONTShowHearts", () => [{ act: "show", feature: "heldSuit", suit: "hearts" }]],
  ["DONTShowSpades", () => [{ act: "show", feature: "heldSuit", suit: "spades" }]],
  ["DONTShowHeartsFromDiamonds", () => [{ act: "show", feature: "heldSuit", suit: "hearts" }]],
  ["DONTShowSpadesFromDiamonds", () => [{ act: "show", feature: "heldSuit", suit: "spades" }]],
]);

// ── Public API ─────────────────────────────────────────────────────

/**
 * Normalize a sourceIntent into canonical bridge observations.
 *
 * Returns `[]` for unknown intent types (graceful degradation).
 * The exhaustiveness coverage test guards against drift.
 */
export function normalizeIntent(intent: SourceIntent): readonly BidAction[] {
  const mapper = INTENT_MAP.get(intent.type);
  if (!mapper) return [];
  return mapper(intent.params);
}

/**
 * Check whether a given intent type has a normalization mapping.
 * Useful for CI drift detection.
 */
export function hasNormalization(intentType: string): boolean {
  return INTENT_MAP.has(intentType);
}
