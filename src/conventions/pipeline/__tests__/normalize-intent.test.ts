/**
 * Tests for normalizeIntent() — sourceIntent → BidAction[] mapping.
 *
 * Covers all 78 intent types across 7 modules. Each test verifies the
 * canonical observation output for a given sourceIntent shape.
 */

import { describe, it, expect } from "vitest";
import { normalizeIntent } from "../observation/normalize-intent";
import type { BidAction } from "../bid-action";
import { getAllModules } from "../../definitions/module-registry";
import { moduleSurfaces } from "../../core/convention-module";
import { HandStrength, ObsSuit, SuitQuality } from "../bid-action";

// ── Helper ─────────────────────────────────────────────────────────

function normalize(
  type: string,
  params: Record<string, string | number | boolean> = {},
): readonly BidAction[] {
  return normalizeIntent({ type, params });
}

// ── Unknown intent ─────────────────────────────────────────────────

describe("normalizeIntent", () => {
  it("returns empty array for unknown intent", () => {
    expect(normalize("UnknownIntent")).toEqual([]);
  });

  // ── Natural openings (5 intents) ──────────────────────────────

  describe("Natural openings", () => {
    it("normalizes NTOpening", () => {
      expect(normalize("NTOpening")).toEqual([
        { act: "open", strain: "notrump" },
      ]);
    });

    it.each([
      ["clubs", "clubs"],
      ["diamonds", "diamonds"],
      ["hearts", "hearts"],
      ["spades", "spades"],
    ] as const)("normalizes SuitOpen(%s)", (suit, expectedStrain) => {
      expect(normalize("SuitOpen", { suit })).toEqual([
        { act: "open", strain: expectedStrain },
      ]);
    });

    it("normalizes NTInvite", () => {
      expect(normalize("NTInvite")).toEqual([
        { act: "raise", strain: "notrump", strength: HandStrength.Invitational },
      ]);
    });

    it("normalizes NTGame", () => {
      expect(normalize("NTGame")).toEqual([
        { act: "raise", strain: "notrump", strength: HandStrength.Game },
      ]);
    });

    it("normalizes TerminalPass", () => {
      expect(normalize("TerminalPass")).toEqual([{ act: "pass" }]);
    });
  });

  // ── Stayman (8 intents) ────────────────────────────────────────

  describe("Stayman", () => {
    it("normalizes StaymanAsk", () => {
      expect(normalize("StaymanAsk")).toEqual([
        { act: "inquire", feature: "majorSuit" },
      ]);
    });

    it("normalizes StaymanAsk with reason param", () => {
      expect(normalize("StaymanAsk", { reason: "smolen" })).toEqual([
        { act: "inquire", feature: "majorSuit" },
      ]);
    });

    it("normalizes ShowHeldSuit with hearts", () => {
      expect(normalize("ShowHeldSuit", { suit: ObsSuit.Hearts })).toEqual([
        { act: "show", feature: "heldSuit", suit: ObsSuit.Hearts },
      ]);
    });

    it("normalizes ShowHeldSuit with spades", () => {
      expect(normalize("ShowHeldSuit", { suit: ObsSuit.Spades })).toEqual([
        { act: "show", feature: "heldSuit", suit: ObsSuit.Spades },
      ]);
    });

    it("normalizes DenyMajor", () => {
      expect(normalize("DenyMajor")).toEqual([
        { act: "deny", feature: "majorSuit" },
      ]);
    });

    it("normalizes RaiseGame with suit", () => {
      expect(normalize("RaiseGame", { suit: ObsSuit.Hearts })).toEqual([
        { act: "raise", strain: ObsSuit.Hearts, strength: HandStrength.Game },
      ]);
    });

    it("normalizes RaiseInvite with suit", () => {
      expect(normalize("RaiseInvite", { suit: ObsSuit.Spades })).toEqual([
        { act: "raise", strain: ObsSuit.Spades, strength: HandStrength.Invitational },
      ]);
    });

    it("normalizes StaymanNTGame", () => {
      expect(normalize("StaymanNTGame")).toEqual([
        { act: "place", strain: "notrump" },
      ]);
    });

    it("normalizes StaymanNTInvite", () => {
      expect(normalize("StaymanNTInvite")).toEqual([
        { act: "raise", strain: "notrump", strength: HandStrength.Invitational },
      ]);
    });

    it("normalizes RedoubleStrength", () => {
      expect(normalize("RedoubleStrength")).toEqual([
        { act: "redouble", feature: "strength" },
      ]);
    });
  });

  // ── Jacoby Transfers (11 intents) ──────────────────────────────

  describe("Jacoby Transfers", () => {
    it("normalizes TransferToHearts", () => {
      expect(normalize("TransferToHearts")).toEqual([
        { act: "transfer", targetSuit: ObsSuit.Hearts },
      ]);
    });

    it("normalizes TransferToSpades", () => {
      expect(normalize("TransferToSpades")).toEqual([
        { act: "transfer", targetSuit: ObsSuit.Spades },
      ]);
    });

    it("normalizes AcceptTransfer with suit", () => {
      expect(normalize("AcceptTransfer", { suit: ObsSuit.Hearts })).toEqual([
        { act: "accept", feature: "heldSuit", suit: ObsSuit.Hearts },
      ]);
    });

    it("normalizes Signoff with suit", () => {
      expect(normalize("Signoff", { suit: ObsSuit.Hearts })).toEqual([
        { act: "signoff", strain: ObsSuit.Hearts },
      ]);
    });

    it("normalizes GameInMajor with suit", () => {
      expect(normalize("GameInMajor", { suit: ObsSuit.Spades })).toEqual([
        { act: "raise", strain: ObsSuit.Spades, strength: HandStrength.Game },
      ]);
    });

    it("normalizes TransferNTGame", () => {
      expect(normalize("TransferNTGame")).toEqual([
        { act: "place", strain: "notrump" },
      ]);
    });

    it("normalizes Invite with suit", () => {
      expect(normalize("Invite", { suit: ObsSuit.Hearts })).toEqual([
        { act: "raise", strain: ObsSuit.Hearts, strength: HandStrength.Invitational },
      ]);
    });

    it("normalizes AcceptInvite", () => {
      expect(normalize("AcceptInvite")).toEqual([
        { act: "accept", feature: "strength", strength: HandStrength.Invitational },
      ]);
    });

    it("normalizes DeclineInvite", () => {
      expect(normalize("DeclineInvite")).toEqual([
        { act: "decline", feature: "strength" },
      ]);
    });

    it("normalizes PlacementCorrection with suit", () => {
      expect(normalize("PlacementCorrection", { suit: ObsSuit.Hearts })).toEqual([
        { act: "place", strain: ObsSuit.Hearts },
      ]);
    });

    it("normalizes PlacementPass", () => {
      expect(normalize("PlacementPass")).toEqual([{ act: "pass" }]);
    });
  });

  // ── Smolen (3 intents) ─────────────────────────────────────────

  describe("Smolen", () => {
    it("normalizes Smolen with longMajor=spades → shortMajor=hearts", () => {
      expect(normalize("Smolen", { longMajor: "spades" })).toEqual([
        { act: "show", feature: "shortMajor", suit: ObsSuit.Hearts },
        { act: "force", level: HandStrength.Game },
      ]);
    });

    it("normalizes Smolen with longMajor=hearts → shortMajor=spades", () => {
      expect(normalize("Smolen", { longMajor: "hearts" })).toEqual([
        { act: "show", feature: "shortMajor", suit: ObsSuit.Spades },
        { act: "force", level: HandStrength.Game },
      ]);
    });

    it("normalizes SmolenPlacement with suit", () => {
      expect(normalize("SmolenPlacement", { suit: ObsSuit.Hearts })).toEqual([
        { act: "place", strain: ObsSuit.Hearts },
      ]);
    });

    it("normalizes SmolenPlacement with notrump", () => {
      expect(normalize("SmolenPlacement", { suit: "notrump" })).toEqual([
        { act: "place", strain: "notrump" },
      ]);
    });

    it("normalizes SmolenAcceptance with suit", () => {
      expect(normalize("SmolenAcceptance", { suit: ObsSuit.Spades })).toEqual([
        { act: "accept", feature: "heldSuit", suit: ObsSuit.Spades },
      ]);
    });
  });

  // ── Bergen (9 intents) ─────────────────────────────────────────

  describe("Bergen", () => {
    it("normalizes Splinter with suit", () => {
      expect(normalize("Splinter", { suit: ObsSuit.Hearts })).toEqual([
        { act: "show", feature: "shortage", suit: ObsSuit.Hearts },
        { act: "raise", strain: ObsSuit.Hearts, strength: HandStrength.Game },
      ]);
    });

    it("normalizes GameRaise with suit", () => {
      expect(normalize("GameRaise", { suit: ObsSuit.Spades })).toEqual([
        { act: "raise", strain: ObsSuit.Spades, strength: HandStrength.Game },
      ]);
    });

    it("normalizes LimitRaise with suit", () => {
      expect(normalize("LimitRaise", { suit: ObsSuit.Hearts })).toEqual([
        { act: "raise", strain: ObsSuit.Hearts, strength: HandStrength.Limit },
      ]);
    });

    it("normalizes ConstructiveRaise with suit", () => {
      expect(normalize("ConstructiveRaise", { suit: ObsSuit.Hearts })).toEqual([
        { act: "raise", strain: ObsSuit.Hearts, strength: HandStrength.Constructive },
      ]);
    });

    it("normalizes PreemptiveRaise with suit", () => {
      expect(normalize("PreemptiveRaise", { suit: ObsSuit.Spades })).toEqual([
        { act: "raise", strain: ObsSuit.Spades, strength: HandStrength.Preemptive },
      ]);
    });

    it("normalizes AcceptInvitation with suit", () => {
      expect(normalize("AcceptInvitation", { suit: ObsSuit.Hearts })).toEqual([
        { act: "accept", feature: "strength", suit: ObsSuit.Hearts, strength: HandStrength.Invitational },
      ]);
    });

    it("normalizes DeclineInvitation with suit", () => {
      expect(normalize("DeclineInvitation", { suit: ObsSuit.Spades })).toEqual([
        { act: "decline", feature: "strength", suit: ObsSuit.Spades },
      ]);
    });

    it("normalizes RaiseToGame with suit", () => {
      expect(normalize("RaiseToGame", { suit: ObsSuit.Hearts })).toEqual([
        { act: "raise", strain: ObsSuit.Hearts, strength: HandStrength.Game },
      ]);
    });

    it("normalizes AcceptPartnerDecision", () => {
      expect(normalize("AcceptPartnerDecision")).toEqual([{ act: "pass" }]);
    });
  });

  // ── Weak Twos (14 intents) ─────────────────────────────────────

  describe("Weak Twos", () => {
    it("normalizes WeakTwoOpen with suit", () => {
      expect(normalize("WeakTwoOpen", { suit: ObsSuit.Hearts })).toEqual([
        { act: "open", strain: ObsSuit.Hearts, strength: HandStrength.Weak },
      ]);
    });

    it("normalizes OgustAsk", () => {
      expect(normalize("OgustAsk")).toEqual([
        { act: "inquire", feature: "suitQuality" },
      ]);
    });

    it("normalizes InviteRaise with suit", () => {
      expect(normalize("InviteRaise", { suit: ObsSuit.Diamonds })).toEqual([
        { act: "raise", strain: ObsSuit.Diamonds, strength: HandStrength.Invitational, feature: "heldSuit" },
      ]);
    });

    it("normalizes WeakPass", () => {
      expect(normalize("WeakPass")).toEqual([{ act: "pass" }]);
    });

    it("normalizes OgustSolid", () => {
      expect(normalize("OgustSolid")).toEqual([
        { act: "show", feature: "suitQuality", quality: SuitQuality.Solid },
      ]);
    });

    it("normalizes OgustMinBad", () => {
      expect(normalize("OgustMinBad")).toEqual([
        { act: "show", feature: "strength", strength: HandStrength.Minimum },
        { act: "show", feature: "suitQuality", quality: SuitQuality.Bad },
      ]);
    });

    it("normalizes OgustMinGood", () => {
      expect(normalize("OgustMinGood")).toEqual([
        { act: "show", feature: "strength", strength: HandStrength.Minimum },
        { act: "show", feature: "suitQuality", quality: SuitQuality.Good },
      ]);
    });

    it("normalizes OgustMaxBad", () => {
      expect(normalize("OgustMaxBad")).toEqual([
        { act: "show", feature: "strength", strength: HandStrength.Maximum },
        { act: "show", feature: "suitQuality", quality: SuitQuality.Bad },
      ]);
    });

    it("normalizes OgustMaxGood", () => {
      expect(normalize("OgustMaxGood")).toEqual([
        { act: "show", feature: "strength", strength: HandStrength.Maximum },
        { act: "show", feature: "suitQuality", quality: SuitQuality.Good },
      ]);
    });

    it("normalizes PostOgustGame with suit", () => {
      expect(normalize("PostOgustGame", { suit: ObsSuit.Hearts })).toEqual([
        { act: "raise", strain: ObsSuit.Hearts, strength: HandStrength.Game },
      ]);
    });

    it("normalizes PostOgust3NT", () => {
      expect(normalize("PostOgust3NT")).toEqual([
        { act: "raise", strain: "notrump", strength: HandStrength.Game },
      ]);
    });

    it("normalizes PostOgustSignoff with suit", () => {
      expect(normalize("PostOgustSignoff", { suit: ObsSuit.Spades })).toEqual([
        { act: "signoff", strain: ObsSuit.Spades },
      ]);
    });

    it("normalizes PostOgustPass", () => {
      expect(normalize("PostOgustPass")).toEqual([{ act: "pass" }]);
    });
  });

  // ── DONT (25 intents) ──────────────────────────────────────────

  describe("DONT", () => {
    it("normalizes DONTBothMajors", () => {
      expect(normalize("DONTBothMajors")).toEqual([
        { act: "overcall", feature: "twoSuited" },
        { act: "show", feature: "heldSuit", suit: ObsSuit.Hearts },
        { act: "show", feature: "heldSuit", suit: ObsSuit.Spades },
      ]);
    });

    it("normalizes DONTDiamondsMajor", () => {
      expect(normalize("DONTDiamondsMajor")).toEqual([
        { act: "overcall", feature: "twoSuited" },
        { act: "show", feature: "heldSuit", suit: ObsSuit.Diamonds },
      ]);
    });

    it("normalizes DONTClubsHigher", () => {
      expect(normalize("DONTClubsHigher")).toEqual([
        { act: "overcall", feature: "twoSuited" },
        { act: "show", feature: "heldSuit", suit: ObsSuit.Clubs },
      ]);
    });

    it("normalizes DONTNaturalSpades", () => {
      expect(normalize("DONTNaturalSpades")).toEqual([
        { act: "overcall", feature: "heldSuit", suit: ObsSuit.Spades },
      ]);
    });

    it("normalizes DONTSingleSuited", () => {
      expect(normalize("DONTSingleSuited")).toEqual([
        { act: "overcall", feature: "heldSuit" },
      ]);
    });

    it("normalizes DONTPass", () => {
      expect(normalize("DONTPass")).toEqual([{ act: "pass" }]);
    });

    it("normalizes DONTAcceptHearts", () => {
      expect(normalize("DONTAcceptHearts")).toEqual([
        { act: "accept", feature: "heldSuit", suit: ObsSuit.Hearts },
      ]);
    });

    it("normalizes DONTPreferSpades", () => {
      expect(normalize("DONTPreferSpades")).toEqual([
        { act: "show", feature: "heldSuit", suit: ObsSuit.Spades },
      ]);
    });

    it("normalizes DONTEscapeClubs", () => {
      expect(normalize("DONTEscapeClubs")).toEqual([
        { act: "show", feature: "heldSuit", suit: ObsSuit.Clubs },
      ]);
    });

    it("normalizes DONTEscapeDiamonds", () => {
      expect(normalize("DONTEscapeDiamonds")).toEqual([
        { act: "show", feature: "heldSuit", suit: ObsSuit.Diamonds },
      ]);
    });

    it("normalizes DONTAcceptDiamonds", () => {
      expect(normalize("DONTAcceptDiamonds")).toEqual([
        { act: "accept", feature: "heldSuit", suit: ObsSuit.Diamonds },
      ]);
    });

    it("normalizes DONTRelayAskMajor", () => {
      expect(normalize("DONTRelayAskMajor")).toEqual([
        { act: "inquire", feature: "majorSuit" },
      ]);
    });

    it("normalizes DONTAcceptClubs", () => {
      expect(normalize("DONTAcceptClubs")).toEqual([
        { act: "accept", feature: "heldSuit", suit: ObsSuit.Clubs },
      ]);
    });

    it("normalizes DONTRelayAskHigher", () => {
      expect(normalize("DONTRelayAskHigher")).toEqual([
        { act: "inquire", feature: "heldSuit" },
      ]);
    });

    it("normalizes DONTAcceptSpades", () => {
      expect(normalize("DONTAcceptSpades")).toEqual([
        { act: "accept", feature: "heldSuit", suit: ObsSuit.Spades },
      ]);
    });

    it("normalizes DONTAcceptSpadesFallback", () => {
      expect(normalize("DONTAcceptSpadesFallback")).toEqual([
        { act: "accept", feature: "heldSuit", suit: ObsSuit.Spades },
      ]);
    });

    it("normalizes DONTForcedRelay", () => {
      expect(normalize("DONTForcedRelay")).toEqual([
        { act: "relay", forced: true },
      ]);
    });

    it("normalizes DONTRevealClubs", () => {
      expect(normalize("DONTRevealClubs")).toEqual([
        { act: "show", feature: "heldSuit", suit: ObsSuit.Clubs },
      ]);
    });

    it("normalizes DONTRevealDiamonds", () => {
      expect(normalize("DONTRevealDiamonds")).toEqual([
        { act: "show", feature: "heldSuit", suit: ObsSuit.Diamonds },
      ]);
    });

    it("normalizes DONTRevealHearts", () => {
      expect(normalize("DONTRevealHearts")).toEqual([
        { act: "show", feature: "heldSuit", suit: ObsSuit.Hearts },
      ]);
    });

    it("normalizes DONTShowDiamonds", () => {
      expect(normalize("DONTShowDiamonds")).toEqual([
        { act: "show", feature: "heldSuit", suit: ObsSuit.Diamonds },
      ]);
    });

    it("normalizes DONTShowHearts", () => {
      expect(normalize("DONTShowHearts")).toEqual([
        { act: "show", feature: "heldSuit", suit: ObsSuit.Hearts },
      ]);
    });

    it("normalizes DONTShowSpades", () => {
      expect(normalize("DONTShowSpades")).toEqual([
        { act: "show", feature: "heldSuit", suit: ObsSuit.Spades },
      ]);
    });

    it("normalizes DONTShowHeartsFromDiamonds", () => {
      expect(normalize("DONTShowHeartsFromDiamonds")).toEqual([
        { act: "show", feature: "heldSuit", suit: ObsSuit.Hearts },
      ]);
    });

    it("normalizes DONTShowSpadesFromDiamonds", () => {
      expect(normalize("DONTShowSpadesFromDiamonds")).toEqual([
        { act: "show", feature: "heldSuit", suit: ObsSuit.Spades },
      ]);
    });
  });

  // ── Exhaustiveness coverage ────────────────────────────────────

  describe("exhaustiveness", () => {
    it("every sourceIntent.type from all modules has a mapping", () => {
      const modules = getAllModules();

      const allIntentTypes = new Set<string>();
      for (const mod of modules) {
        for (const s of moduleSurfaces(mod)) {
          allIntentTypes.add(s.sourceIntent.type);
        }
      }

      const unmapped: string[] = [];
      for (const intentType of allIntentTypes) {
        const result = normalizeIntent({ type: intentType, params: {} });
        if (result.length === 0) {
          unmapped.push(intentType);
        }
      }

      expect(unmapped).toEqual([]);
    });
  });
});
