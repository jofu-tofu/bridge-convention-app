import { describe, it, expect } from "vitest";
import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import {
  resolveEncoding,
  type FrontierStepConfig,
  type RelayMapConfig,
} from "../evaluation/encoder-resolver";

function bid(level: 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: BidSuit): Call {
  return { type: "bid", level, strain };
}

describe("resolveEncoding", () => {
  describe("direct encoder", () => {
    it("returns the defaultCall unchanged", () => {
      const defaultCall = bid(2, BidSuit.Clubs);
      const result = resolveEncoding({
        encoderKind: "direct",
        defaultCall,
        legalCalls: [defaultCall],
      });
      expect(result.chosenCall).toEqual(defaultCall);
      expect(result.encoderKind).toBe("default-call");
    });
  });

  describe("choice-set encoder", () => {
    it("returns the defaultCall unchanged (choice-set uses default-call path)", () => {
      const defaultCall = bid(1, BidSuit.NoTrump);
      const result = resolveEncoding({
        encoderKind: "choice-set",
        defaultCall,
        legalCalls: [defaultCall],
      });
      expect(result.chosenCall).toEqual(defaultCall);
      expect(result.encoderKind).toBe("default-call");
    });
  });

  describe("frontier-step encoder", () => {
    const stepLadder: Call[] = [
      bid(2, BidSuit.Diamonds),
      bid(2, BidSuit.Hearts),
      bid(2, BidSuit.Spades),
      bid(2, BidSuit.NoTrump),
      bid(3, BidSuit.Clubs),
    ];

    it("selects the first legal step from the ladder", () => {
      const config: FrontierStepConfig = {
        stepLadder,
        currentStepIndex: 0,
      };
      const result = resolveEncoding({
        encoderKind: "frontier-step",
        defaultCall: stepLadder[0]!,
        legalCalls: stepLadder,
        encoderConfig: config,
      });
      expect(result.chosenCall).toEqual(bid(2, BidSuit.Diamonds));
      expect(result.encoderKind).toBe("frontier-step");
      expect(result.consideredCalls).toEqual(stepLadder);
    });

    it("selects the step at the specified currentStepIndex", () => {
      const config: FrontierStepConfig = {
        stepLadder,
        currentStepIndex: 2,
      };
      const result = resolveEncoding({
        encoderKind: "frontier-step",
        defaultCall: stepLadder[2]!,
        legalCalls: stepLadder,
        encoderConfig: config,
      });
      expect(result.chosenCall).toEqual(bid(2, BidSuit.Spades));
      expect(result.encoderKind).toBe("frontier-step");
    });

    it("skips illegal steps and selects next legal one", () => {
      const config: FrontierStepConfig = {
        stepLadder,
        currentStepIndex: 0,
      };
      // Only 2H and above are legal (2D was overcalled)
      const legalCalls = [
        bid(2, BidSuit.Hearts),
        bid(2, BidSuit.Spades),
        bid(2, BidSuit.NoTrump),
        bid(3, BidSuit.Clubs),
      ];
      const result = resolveEncoding({
        encoderKind: "frontier-step",
        defaultCall: stepLadder[0]!,
        legalCalls,
        encoderConfig: config,
      });
      expect(result.chosenCall).toEqual(bid(2, BidSuit.Hearts));
      expect(result.blockedCalls).toEqual([
        { call: bid(2, BidSuit.Diamonds), reason: "step_not_legal" },
      ]);
    });

    it("returns undefined chosenCall when no steps are legal", () => {
      const config: FrontierStepConfig = {
        stepLadder,
        currentStepIndex: 0,
      };
      const result = resolveEncoding({
        encoderKind: "frontier-step",
        defaultCall: stepLadder[0]!,
        legalCalls: [], // nothing legal
        encoderConfig: config,
      });
      expect(result.chosenCall).toBeUndefined();
      expect(result.blockedCalls.length).toBe(stepLadder.length);
    });

    it("only considers steps from currentStepIndex onward", () => {
      const config: FrontierStepConfig = {
        stepLadder,
        currentStepIndex: 3,
      };
      const result = resolveEncoding({
        encoderKind: "frontier-step",
        defaultCall: stepLadder[3]!,
        legalCalls: stepLadder,
        encoderConfig: config,
      });
      expect(result.chosenCall).toEqual(bid(2, BidSuit.NoTrump));
      // Only steps from index 3 onward are considered
      expect(result.consideredCalls).toEqual([
        bid(2, BidSuit.NoTrump),
        bid(3, BidSuit.Clubs),
      ]);
    });
  });

  describe("relay-map encoder", () => {
    const relayEntries: RelayMapConfig["entries"] = [
      { position: "min", call: bid(2, BidSuit.Diamonds) },
      { position: "mid-low", call: bid(2, BidSuit.Hearts) },
      { position: "mid-high", call: bid(2, BidSuit.Spades) },
      { position: "max", call: bid(2, BidSuit.NoTrump) },
    ];

    it("selects the call for the matched relay position", () => {
      const config: RelayMapConfig = {
        entries: relayEntries,
        activePosition: "mid-low",
      };
      const result = resolveEncoding({
        encoderKind: "relay-map",
        defaultCall: bid(2, BidSuit.Hearts),
        legalCalls: relayEntries.map((e) => e.call),
        encoderConfig: config,
      });
      expect(result.chosenCall).toEqual(bid(2, BidSuit.Hearts));
      expect(result.encoderKind).toBe("relay-map");
    });

    it("returns undefined chosenCall when the mapped call is not legal", () => {
      const config: RelayMapConfig = {
        entries: relayEntries,
        activePosition: "mid-low",
      };
      // 2H is not legal
      const legalCalls = [bid(2, BidSuit.Spades), bid(2, BidSuit.NoTrump)];
      const result = resolveEncoding({
        encoderKind: "relay-map",
        defaultCall: bid(2, BidSuit.Hearts),
        legalCalls,
        encoderConfig: config,
      });
      expect(result.chosenCall).toBeUndefined();
      expect(result.blockedCalls).toEqual([
        { call: bid(2, BidSuit.Hearts), reason: "mapped_call_not_legal" },
      ]);
    });

    it("returns undefined chosenCall when activePosition has no mapping", () => {
      const config: RelayMapConfig = {
        entries: relayEntries,
        activePosition: "unknown-position",
      };
      const result = resolveEncoding({
        encoderKind: "relay-map",
        defaultCall: bid(2, BidSuit.Hearts),
        legalCalls: relayEntries.map((e) => e.call),
        encoderConfig: config,
      });
      expect(result.chosenCall).toBeUndefined();
      expect(result.blockedCalls).toHaveLength(0);
    });

    it("reports all entries as consideredCalls", () => {
      const config: RelayMapConfig = {
        entries: relayEntries,
        activePosition: "max",
      };
      const result = resolveEncoding({
        encoderKind: "relay-map",
        defaultCall: bid(2, BidSuit.NoTrump),
        legalCalls: relayEntries.map((e) => e.call),
        encoderConfig: config,
      });
      expect(result.consideredCalls).toEqual(relayEntries.map((e) => e.call));
      expect(result.chosenCall).toEqual(bid(2, BidSuit.NoTrump));
    });
  });
});
