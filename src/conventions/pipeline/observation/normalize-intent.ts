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

import {
  ObsSuit,
  HandStrength,
  SuitQuality,
  type BidAction,
  type BidSuitName,
} from "../bid-action";

// ── Types ──────────────────────────────────────────────────────────

interface SourceIntent {
  readonly type: string;
  readonly params: Readonly<Record<string, string | number | boolean>>;
}

type IntentMapper = (params: Readonly<Record<string, string | number | boolean>>) => readonly BidAction[];

// ── Helpers ────────────────────────────────────────────────────────

function otherMajor(suit: string): ObsSuit {
  return suit === "hearts" ? ObsSuit.Spades : ObsSuit.Hearts;
}

function suit(params: Readonly<Record<string, string | number | boolean>>): ObsSuit {
  return params.suit as ObsSuit;
}

function strain(params: Readonly<Record<string, string | number | boolean>>): BidSuitName {
  return params.suit as BidSuitName;
}

// ── Mapping table ──────────────────────────────────────────────────

const INTENT_MAP: ReadonlyMap<string, IntentMapper> = new Map<string, IntentMapper>([
  // ── Natural openings ────────────────────────────────────────────
  ["NTOpening", () => [{ act: "open", strain: "notrump" }]],
  ["SuitOpen", (p) => [{ act: "open", strain: strain(p) }]],
  ["NTInvite", () => [{ act: "raise", strain: "notrump", strength: HandStrength.Invitational }]],
  ["NTGame", () => [{ act: "raise", strain: "notrump", strength: HandStrength.Game }]],
  ["TerminalPass", () => [{ act: "pass" }]],

  // ── Stayman ──────────────────────────────────────────────────────
  ["StaymanAsk", () => [{ act: "inquire", feature: "majorSuit" }]],
  ["ShowHeldSuit", (p) => [{ act: "show", feature: "heldSuit", suit: suit(p) }]],
  ["ShowFiveCardMajor", (p) => [{ act: "show", feature: "heldSuit", suit: suit(p) }]],
  ["DenyMajor", () => [{ act: "deny", feature: "majorSuit" }]],
  ["RaiseGame", (p) => [{ act: "raise", strain: strain(p), strength: HandStrength.Game }]],
  ["RaiseInvite", (p) => [{ act: "raise", strain: strain(p), strength: HandStrength.Invitational }]],
  ["StaymanNTGame", () => [{ act: "place", strain: "notrump" }]],
  ["StaymanNTInvite", () => [{ act: "raise", strain: "notrump", strength: HandStrength.Invitational }]],
  ["CrossMajorInvite", (p) => [{ act: "show", feature: "heldSuit", suit: suit(p) }]],
  ["CrossMajorGF", (p) => [{ act: "show", feature: "heldSuit", suit: suit(p) }, { act: "force", level: HandStrength.Game }]],
  ["MinorSuitGF", (p) => [{ act: "show", feature: "heldSuit", suit: suit(p) }, { act: "force", level: HandStrength.Game }]],
  ["MajorSignoff64", (p) => [{ act: "signoff", strain: strain(p) }]],
  ["Quantitative4NT", () => [{ act: "raise", strain: "notrump", strength: HandStrength.SlamInvite }]],
  ["RedoubleStrength", () => [{ act: "redouble", feature: "strength" }]],

  // ── Jacoby Transfers ─────────────────────────────────────────────
  ["TransferToHearts", () => [{ act: "transfer", targetSuit: ObsSuit.Hearts }]],
  ["TransferToSpades", () => [{ act: "transfer", targetSuit: ObsSuit.Spades }]],
  ["AcceptTransfer", (p) => [{ act: "accept", feature: "heldSuit", suit: suit(p) }]],
  ["Signoff", (p) => [{ act: "signoff", strain: strain(p) }]],
  ["GameInMajor", (p) => [{ act: "raise", strain: strain(p), strength: HandStrength.Game }]],
  ["TransferNTGame", () => [{ act: "place", strain: "notrump" }]],
  ["Invite", (p) => [{ act: "raise", strain: strain(p), strength: HandStrength.Invitational }]],
  ["AcceptInvite", () => [{ act: "accept", feature: "strength", strength: HandStrength.Invitational }]],
  ["DeclineInvite", () => [{ act: "decline", feature: "strength" }]],
  ["SignoffWithFit", (p) => [{ act: "signoff", strain: strain(p) }]],
  ["PlacementCorrection", (p) => [{ act: "place", strain: strain(p) }]],
  ["PlacementPass", () => [{ act: "pass" }]],

  // ── Smolen ───────────────────────────────────────────────────────
  ["Smolen", (p) => [
    { act: "show", feature: "shortMajor", suit: otherMajor(p.longMajor as string) },
    { act: "force", level: HandStrength.Game },
  ]],
  ["SmolenPlacement", (p) => [{ act: "place", strain: strain(p) }]],
  ["SmolenAcceptance", (p) => [{ act: "accept", feature: "heldSuit", suit: suit(p) }]],

  // ── Major Opening (stub for rule module phase transitions) ───────
  ["MajorOpen", (p) => [{ act: "open", strain: strain(p) }]],

  // ── Bergen ───────────────────────────────────────────────────────
  ["Splinter", (p) => [
    { act: "show", feature: "shortage", suit: suit(p) },
    { act: "raise", strain: strain(p), strength: HandStrength.Game },
  ]],
  ["GameRaise", (p) => [{ act: "raise", strain: strain(p), strength: HandStrength.Game }]],
  ["LimitRaise", (p) => [{ act: "raise", strain: strain(p), strength: HandStrength.Limit }]],
  ["ConstructiveRaise", (p) => [{ act: "raise", strain: strain(p), strength: HandStrength.Constructive }]],
  ["PreemptiveRaise", (p) => [{ act: "raise", strain: strain(p), strength: HandStrength.Preemptive }]],
  ["AcceptInvitation", (p) => [{ act: "accept", feature: "strength", suit: suit(p), strength: HandStrength.Invitational }]],
  ["GameTry", (p) => [{ act: "accept", feature: "strength", suit: suit(p), strength: HandStrength.Invitational }]],
  ["DeclineInvitation", (p) => [{ act: "decline", feature: "strength", suit: suit(p) }]],
  ["RaiseToGame", (p) => [{ act: "raise", strain: strain(p), strength: HandStrength.Game }]],
  ["AcceptPartnerDecision", () => [{ act: "pass" }]],

  // ── Natural 1NT response (Bergen alternative) ────────────────────
  ["NaturalNtResponse", () => [{ act: "place", strain: "notrump" }]],

  // ── Weak Twos ────────────────────────────────────────────────────
  ["WeakTwoOpen", (p) => [{ act: "open", strain: strain(p), strength: HandStrength.Weak }]],
  ["OgustAsk", () => [{ act: "inquire", feature: "suitQuality" }]],
  ["InviteRaise", (p) => [{ act: "raise", strain: strain(p), strength: HandStrength.Invitational, feature: "heldSuit" }]],

  // ── Jacoby Transfers (new continuations) ───────────────────────
  ["InviteMajorMajor", (p) => [{ act: "raise", strain: strain(p), strength: HandStrength.Invitational }]],
  ["NewSuitGameForce", (p) => [{ act: "show", feature: "heldSuit", suit: suit(p) }]],
  ["ShortageSlamTry", (p) => [{ act: "show", feature: "shortage", suit: suit(p) }]],
  ["QuantitativeSlam", () => [{ act: "raise", strain: "notrump", strength: HandStrength.SlamInvite }]],
  ["SlamTrySecondMajor", (p) => [{ act: "show", feature: "heldSuit", suit: suit(p), strength: HandStrength.SlamInvite }]],
  ["GameInOtherMajor", (p) => [{ act: "raise", strain: strain(p), strength: HandStrength.Game }]],
  ["WeakPass", () => [{ act: "pass" }]],
  ["OgustSolid", () => [{ act: "show", feature: "suitQuality", quality: SuitQuality.Solid }]],
  ["OgustMinBad", () => [
    { act: "show", feature: "strength", strength: HandStrength.Minimum },
    { act: "show", feature: "suitQuality", quality: SuitQuality.Bad },
  ]],
  ["OgustMinGood", () => [
    { act: "show", feature: "strength", strength: HandStrength.Minimum },
    { act: "show", feature: "suitQuality", quality: SuitQuality.Good },
  ]],
  ["OgustMaxBad", () => [
    { act: "show", feature: "strength", strength: HandStrength.Maximum },
    { act: "show", feature: "suitQuality", quality: SuitQuality.Bad },
  ]],
  ["OgustMaxGood", () => [
    { act: "show", feature: "strength", strength: HandStrength.Maximum },
    { act: "show", feature: "suitQuality", quality: SuitQuality.Good },
  ]],
  ["PostOgustGame", (p) => [{ act: "raise", strain: strain(p), strength: HandStrength.Game }]],
  ["PostOgust3NT", () => [{ act: "raise", strain: "notrump", strength: HandStrength.Game }]],
  ["PostOgustSignoff", (p) => [{ act: "signoff", strain: strain(p) }]],
  ["PreemptiveRaise", (p) => [{ act: "raise", strain: strain(p), strength: HandStrength.Preemptive }]],
  ["NewSuitForcing", () => [{ act: "show", feature: "heldSuit" }]],
  ["NsfSupport", () => [{ act: "raise", strain: "notrump", strength: HandStrength.Minimum }]],
  ["NsfRebid", (p) => [{ act: "signoff", strain: strain(p) }]],
  ["PostOgustPass", () => [{ act: "pass" }]],

  // ── DONT ─────────────────────────────────────────────────────────
  ["DONTBothMajors", () => [
    { act: "overcall", feature: "twoSuited" },
    { act: "show", feature: "heldSuit", suit: ObsSuit.Hearts },
    { act: "show", feature: "heldSuit", suit: ObsSuit.Spades },
  ]],
  ["DONTDiamondsMajor", () => [
    { act: "overcall", feature: "twoSuited" },
    { act: "show", feature: "heldSuit", suit: ObsSuit.Diamonds },
  ]],
  ["DONTClubsHigher", () => [
    { act: "overcall", feature: "twoSuited" },
    { act: "show", feature: "heldSuit", suit: ObsSuit.Clubs },
  ]],
  ["DONTNaturalSpades", () => [{ act: "overcall", feature: "heldSuit", suit: ObsSuit.Spades }]],
  ["DONTSingleSuited", () => [{ act: "overcall", feature: "heldSuit" }]],
  ["DONTPass", () => [{ act: "pass" }]],
  ["DONTAcceptHearts", () => [{ act: "accept", feature: "heldSuit", suit: ObsSuit.Hearts }]],
  ["DONTPreferSpades", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Spades }]],
  ["DONTEscapeClubs", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Clubs }]],
  ["DONTEscapeDiamonds", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Diamonds }]],
  ["DONTAcceptDiamonds", () => [{ act: "accept", feature: "heldSuit", suit: ObsSuit.Diamonds }]],
  ["DONTRelayAskMajor", () => [{ act: "inquire", feature: "majorSuit" }]],
  ["DONTAcceptClubs", () => [{ act: "accept", feature: "heldSuit", suit: ObsSuit.Clubs }]],
  ["DONTRelayAskHigher", () => [{ act: "inquire", feature: "heldSuit" }]],
  ["DONTAcceptSpades", () => [{ act: "accept", feature: "heldSuit", suit: ObsSuit.Spades }]],
  ["DONTAcceptSpadesFallback", () => [{ act: "accept", feature: "heldSuit", suit: ObsSuit.Spades }]],
  ["DONTForcedRelay", () => [{ act: "relay", forced: true }]],
  ["DONTRevealClubs", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Clubs }]],
  ["DONTRevealDiamonds", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Diamonds }]],
  ["DONTRevealHearts", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Hearts }]],
  ["DONTShowDiamonds", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Diamonds }]],
  ["DONTShowHearts", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Hearts }]],
  ["DONTShowSpades", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Spades }]],
  ["DONTShowHeartsFromDiamonds", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Hearts }]],
  ["DONTShowSpadesFromDiamonds", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Spades }]],
  ["DONTBypassDiamonds", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Diamonds }]],
  ["DONTBypassHearts", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Hearts }]],
  ["DONTBypassSpades", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Spades }]],
  ["DONTBypassHeartsAfter2C", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Hearts }]],
  ["DONTBypassSpadesAfter2C", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Spades }]],
  ["DONTBypassSpadesAfter2D", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Spades }]],
  ["DONTEscape3CAfter2S", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Clubs }]],
  ["DONTEscape3DAfter2S", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Diamonds }]],
  ["DONTEscape3HAfter2S", () => [{ act: "show", feature: "heldSuit", suit: ObsSuit.Hearts }]],

  // ── Blackwood ──────────────────────────────────────────────────
  ["BlackwoodAsk", (p) => [{ act: "inquire", feature: p.feature === "kings" ? "control" as const : "keyCards" as const }]],
  ["ShowAceCount", () => [{ act: "show", feature: "keyCards" }]],
  ["ShowKingCount", () => [{ act: "show", feature: "control" }]],
  ["BlackwoodSignoff", () => [{ act: "signoff", strain: "notrump" }]],
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


