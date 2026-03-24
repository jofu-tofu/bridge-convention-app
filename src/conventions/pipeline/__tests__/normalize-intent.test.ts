/**
 * Tests for normalizeIntent() — sourceIntent → BidAction[] mapping.
 *
 * Covers all 78 intent types across 7 modules. Each test verifies the
 * canonical observation output for a given sourceIntent shape.
 */

import { describe, it, expect } from "vitest";
import { normalizeIntent } from "../normalize-intent";
import type { BidAction } from "../bid-action";
import { getAllModules } from "../../definitions/module-registry";
import { moduleSurfaces } from "../../core/convention-module";

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

  // ── Natural NT (4 intents) ─────────────────────────────────────

  describe("Natural NT", () => {
    it("normalizes NTOpening", () => {
      expect(normalize("NTOpening")).toEqual([
        { act: "open", strain: "notrump" },
      ]);
    });

    it("normalizes NTInvite", () => {
      expect(normalize("NTInvite")).toEqual([
        { act: "raise", strain: "notrump", strength: "invitational" },
      ]);
    });

    it("normalizes NTGame", () => {
      expect(normalize("NTGame")).toEqual([
        { act: "raise", strain: "notrump", strength: "game" },
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
      expect(normalize("ShowHeldSuit", { suit: "hearts" })).toEqual([
        { act: "show", feature: "heldSuit", suit: "hearts" },
      ]);
    });

    it("normalizes ShowHeldSuit with spades", () => {
      expect(normalize("ShowHeldSuit", { suit: "spades" })).toEqual([
        { act: "show", feature: "heldSuit", suit: "spades" },
      ]);
    });

    it("normalizes DenyMajor", () => {
      expect(normalize("DenyMajor")).toEqual([
        { act: "deny", feature: "majorSuit" },
      ]);
    });

    it("normalizes RaiseGame with suit", () => {
      expect(normalize("RaiseGame", { suit: "hearts" })).toEqual([
        { act: "raise", strain: "hearts", strength: "game" },
      ]);
    });

    it("normalizes RaiseInvite with suit", () => {
      expect(normalize("RaiseInvite", { suit: "spades" })).toEqual([
        { act: "raise", strain: "spades", strength: "invitational" },
      ]);
    });

    it("normalizes StaymanNTGame", () => {
      expect(normalize("StaymanNTGame")).toEqual([
        { act: "place", strain: "notrump" },
      ]);
    });

    it("normalizes StaymanNTInvite", () => {
      expect(normalize("StaymanNTInvite")).toEqual([
        { act: "raise", strain: "notrump", strength: "invitational" },
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
        { act: "transfer", targetSuit: "hearts" },
      ]);
    });

    it("normalizes TransferToSpades", () => {
      expect(normalize("TransferToSpades")).toEqual([
        { act: "transfer", targetSuit: "spades" },
      ]);
    });

    it("normalizes AcceptTransfer with suit", () => {
      expect(normalize("AcceptTransfer", { suit: "hearts" })).toEqual([
        { act: "accept", feature: "heldSuit", suit: "hearts" },
      ]);
    });

    it("normalizes Signoff with suit", () => {
      expect(normalize("Signoff", { suit: "hearts" })).toEqual([
        { act: "signoff", strain: "hearts" },
      ]);
    });

    it("normalizes GameInMajor with suit", () => {
      expect(normalize("GameInMajor", { suit: "spades" })).toEqual([
        { act: "raise", strain: "spades", strength: "game" },
      ]);
    });

    it("normalizes TransferNTGame", () => {
      expect(normalize("TransferNTGame")).toEqual([
        { act: "place", strain: "notrump" },
      ]);
    });

    it("normalizes Invite with suit", () => {
      expect(normalize("Invite", { suit: "hearts" })).toEqual([
        { act: "raise", strain: "hearts", strength: "invitational" },
      ]);
    });

    it("normalizes AcceptInvite", () => {
      expect(normalize("AcceptInvite")).toEqual([
        { act: "accept", feature: "strength", strength: "invitational" },
      ]);
    });

    it("normalizes DeclineInvite", () => {
      expect(normalize("DeclineInvite")).toEqual([
        { act: "decline", feature: "strength" },
      ]);
    });

    it("normalizes PlacementCorrection with suit", () => {
      expect(normalize("PlacementCorrection", { suit: "hearts" })).toEqual([
        { act: "place", strain: "hearts" },
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
        { act: "show", feature: "shortMajor", suit: "hearts" },
        { act: "force", level: "game" },
      ]);
    });

    it("normalizes Smolen with longMajor=hearts → shortMajor=spades", () => {
      expect(normalize("Smolen", { longMajor: "hearts" })).toEqual([
        { act: "show", feature: "shortMajor", suit: "spades" },
        { act: "force", level: "game" },
      ]);
    });

    it("normalizes SmolenPlacement with suit", () => {
      expect(normalize("SmolenPlacement", { suit: "hearts" })).toEqual([
        { act: "place", strain: "hearts" },
      ]);
    });

    it("normalizes SmolenPlacement with notrump", () => {
      expect(normalize("SmolenPlacement", { suit: "notrump" })).toEqual([
        { act: "place", strain: "notrump" },
      ]);
    });
  });

  // ── Bergen (9 intents) ─────────────────────────────────────────

  describe("Bergen", () => {
    it("normalizes Splinter with suit", () => {
      expect(normalize("Splinter", { suit: "hearts" })).toEqual([
        { act: "show", feature: "shortage", suit: "hearts" },
        { act: "raise", strain: "hearts", strength: "game" },
      ]);
    });

    it("normalizes GameRaise with suit", () => {
      expect(normalize("GameRaise", { suit: "spades" })).toEqual([
        { act: "raise", strain: "spades", strength: "game" },
      ]);
    });

    it("normalizes LimitRaise with suit", () => {
      expect(normalize("LimitRaise", { suit: "hearts" })).toEqual([
        { act: "raise", strain: "hearts", strength: "limit" },
      ]);
    });

    it("normalizes ConstructiveRaise with suit", () => {
      expect(normalize("ConstructiveRaise", { suit: "hearts" })).toEqual([
        { act: "raise", strain: "hearts", strength: "constructive" },
      ]);
    });

    it("normalizes PreemptiveRaise with suit", () => {
      expect(normalize("PreemptiveRaise", { suit: "spades" })).toEqual([
        { act: "raise", strain: "spades", strength: "preemptive" },
      ]);
    });

    it("normalizes AcceptInvitation with suit", () => {
      expect(normalize("AcceptInvitation", { suit: "hearts" })).toEqual([
        { act: "accept", feature: "strength", suit: "hearts", strength: "invitational" },
      ]);
    });

    it("normalizes DeclineInvitation with suit", () => {
      expect(normalize("DeclineInvitation", { suit: "spades" })).toEqual([
        { act: "decline", feature: "strength", suit: "spades" },
      ]);
    });

    it("normalizes RaiseToGame with suit", () => {
      expect(normalize("RaiseToGame", { suit: "hearts" })).toEqual([
        { act: "raise", strain: "hearts", strength: "game" },
      ]);
    });

    it("normalizes AcceptPartnerDecision", () => {
      expect(normalize("AcceptPartnerDecision")).toEqual([{ act: "pass" }]);
    });
  });

  // ── Weak Twos (14 intents) ─────────────────────────────────────

  describe("Weak Twos", () => {
    it("normalizes WeakTwoOpen with suit", () => {
      expect(normalize("WeakTwoOpen", { suit: "hearts" })).toEqual([
        { act: "open", strain: "hearts", strength: "weak" },
      ]);
    });

    it("normalizes OgustAsk", () => {
      expect(normalize("OgustAsk")).toEqual([
        { act: "inquire", feature: "suitQuality" },
      ]);
    });

    it("normalizes InviteRaise with suit", () => {
      expect(normalize("InviteRaise", { suit: "diamonds" })).toEqual([
        { act: "raise", strain: "diamonds", strength: "invitational", feature: "heldSuit" },
      ]);
    });

    it("normalizes WeakPass", () => {
      expect(normalize("WeakPass")).toEqual([{ act: "pass" }]);
    });

    it("normalizes OgustSolid", () => {
      expect(normalize("OgustSolid")).toEqual([
        { act: "show", feature: "suitQuality", quality: "solid" },
      ]);
    });

    it("normalizes OgustMinBad", () => {
      expect(normalize("OgustMinBad")).toEqual([
        { act: "show", feature: "strength", strength: "minimum" },
        { act: "show", feature: "suitQuality", quality: "bad" },
      ]);
    });

    it("normalizes OgustMinGood", () => {
      expect(normalize("OgustMinGood")).toEqual([
        { act: "show", feature: "strength", strength: "minimum" },
        { act: "show", feature: "suitQuality", quality: "good" },
      ]);
    });

    it("normalizes OgustMaxBad", () => {
      expect(normalize("OgustMaxBad")).toEqual([
        { act: "show", feature: "strength", strength: "maximum" },
        { act: "show", feature: "suitQuality", quality: "bad" },
      ]);
    });

    it("normalizes OgustMaxGood", () => {
      expect(normalize("OgustMaxGood")).toEqual([
        { act: "show", feature: "strength", strength: "maximum" },
        { act: "show", feature: "suitQuality", quality: "good" },
      ]);
    });

    it("normalizes PostOgustGame with suit", () => {
      expect(normalize("PostOgustGame", { suit: "hearts" })).toEqual([
        { act: "raise", strain: "hearts", strength: "game" },
      ]);
    });

    it("normalizes PostOgust3NT", () => {
      expect(normalize("PostOgust3NT")).toEqual([
        { act: "raise", strain: "notrump", strength: "game" },
      ]);
    });

    it("normalizes PostOgustSignoff with suit", () => {
      expect(normalize("PostOgustSignoff", { suit: "spades" })).toEqual([
        { act: "signoff", strain: "spades" },
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
        { act: "show", feature: "heldSuit", suit: "hearts" },
        { act: "show", feature: "heldSuit", suit: "spades" },
      ]);
    });

    it("normalizes DONTDiamondsMajor", () => {
      expect(normalize("DONTDiamondsMajor")).toEqual([
        { act: "overcall", feature: "twoSuited" },
        { act: "show", feature: "heldSuit", suit: "diamonds" },
      ]);
    });

    it("normalizes DONTClubsHigher", () => {
      expect(normalize("DONTClubsHigher")).toEqual([
        { act: "overcall", feature: "twoSuited" },
        { act: "show", feature: "heldSuit", suit: "clubs" },
      ]);
    });

    it("normalizes DONTNaturalSpades", () => {
      expect(normalize("DONTNaturalSpades")).toEqual([
        { act: "overcall", feature: "heldSuit", suit: "spades" },
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
        { act: "accept", feature: "heldSuit", suit: "hearts" },
      ]);
    });

    it("normalizes DONTPreferSpades", () => {
      expect(normalize("DONTPreferSpades")).toEqual([
        { act: "show", feature: "heldSuit", suit: "spades" },
      ]);
    });

    it("normalizes DONTEscapeClubs", () => {
      expect(normalize("DONTEscapeClubs")).toEqual([
        { act: "show", feature: "heldSuit", suit: "clubs" },
      ]);
    });

    it("normalizes DONTEscapeDiamonds", () => {
      expect(normalize("DONTEscapeDiamonds")).toEqual([
        { act: "show", feature: "heldSuit", suit: "diamonds" },
      ]);
    });

    it("normalizes DONTAcceptDiamonds", () => {
      expect(normalize("DONTAcceptDiamonds")).toEqual([
        { act: "accept", feature: "heldSuit", suit: "diamonds" },
      ]);
    });

    it("normalizes DONTRelayAskMajor", () => {
      expect(normalize("DONTRelayAskMajor")).toEqual([
        { act: "inquire", feature: "majorSuit" },
      ]);
    });

    it("normalizes DONTAcceptClubs", () => {
      expect(normalize("DONTAcceptClubs")).toEqual([
        { act: "accept", feature: "heldSuit", suit: "clubs" },
      ]);
    });

    it("normalizes DONTRelayAskHigher", () => {
      expect(normalize("DONTRelayAskHigher")).toEqual([
        { act: "inquire", feature: "heldSuit" },
      ]);
    });

    it("normalizes DONTAcceptSpades", () => {
      expect(normalize("DONTAcceptSpades")).toEqual([
        { act: "accept", feature: "heldSuit", suit: "spades" },
      ]);
    });

    it("normalizes DONTAcceptSpadesFallback", () => {
      expect(normalize("DONTAcceptSpadesFallback")).toEqual([
        { act: "accept", feature: "heldSuit", suit: "spades" },
      ]);
    });

    it("normalizes DONTForcedRelay", () => {
      expect(normalize("DONTForcedRelay")).toEqual([
        { act: "relay", forced: true },
      ]);
    });

    it("normalizes DONTRevealClubs", () => {
      expect(normalize("DONTRevealClubs")).toEqual([
        { act: "show", feature: "heldSuit", suit: "clubs" },
      ]);
    });

    it("normalizes DONTRevealDiamonds", () => {
      expect(normalize("DONTRevealDiamonds")).toEqual([
        { act: "show", feature: "heldSuit", suit: "diamonds" },
      ]);
    });

    it("normalizes DONTRevealHearts", () => {
      expect(normalize("DONTRevealHearts")).toEqual([
        { act: "show", feature: "heldSuit", suit: "hearts" },
      ]);
    });

    it("normalizes DONTShowDiamonds", () => {
      expect(normalize("DONTShowDiamonds")).toEqual([
        { act: "show", feature: "heldSuit", suit: "diamonds" },
      ]);
    });

    it("normalizes DONTShowHearts", () => {
      expect(normalize("DONTShowHearts")).toEqual([
        { act: "show", feature: "heldSuit", suit: "hearts" },
      ]);
    });

    it("normalizes DONTShowSpades", () => {
      expect(normalize("DONTShowSpades")).toEqual([
        { act: "show", feature: "heldSuit", suit: "spades" },
      ]);
    });

    it("normalizes DONTShowHeartsFromDiamonds", () => {
      expect(normalize("DONTShowHeartsFromDiamonds")).toEqual([
        { act: "show", feature: "heldSuit", suit: "hearts" },
      ]);
    });

    it("normalizes DONTShowSpadesFromDiamonds", () => {
      expect(normalize("DONTShowSpadesFromDiamonds")).toEqual([
        { act: "show", feature: "heldSuit", suit: "spades" },
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
