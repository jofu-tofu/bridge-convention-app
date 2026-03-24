/**
 * Type-level compile-time assertions for the canonical observation ontology.
 *
 * These tests use `satisfies` to verify that each act variant has the expected
 * shape. Type errors here mean the discriminated union is malformed.
 */

import { describe, it, expect } from "vitest";
import type { BidAction, BidActionType } from "../bid-action";
import { BID_ACTION_TYPES } from "../bid-action";

// ── Helper: exhaustive switch over BidActionType ─────────────────────────
function describeAct(obs: BidAction): string {
  switch (obs.act) {
    case "open":
      return `open ${obs.strain}`;
    case "show":
      return `show ${obs.feature}`;
    case "deny":
      return `deny ${obs.feature}`;
    case "inquire":
      return `inquire ${obs.feature}`;
    case "transfer":
      return `transfer to ${obs.targetSuit}`;
    case "accept":
      return `accept ${obs.feature}`;
    case "decline":
      return `decline ${obs.feature}`;
    case "raise":
      return `raise ${obs.strain} ${obs.strength}`;
    case "place":
      return `place ${obs.strain}`;
    case "signoff":
      return `signoff ${obs.strain ?? "unknown"}`;
    case "force":
      return `force ${obs.level}`;
    case "agree":
      return `agree ${obs.strain}`;
    case "relay":
      return `relay forced=${obs.forced}`;
    case "overcall":
      return `overcall ${obs.feature}`;
    case "double":
      return `double ${obs.feature}`;
    case "pass":
      return "pass";
    case "redouble":
      return `redouble ${obs.feature}`;
  }
}

describe("BidAction type definitions", () => {
  it("each act variant satisfies BidAction with correct shape", () => {
    // These are compile-time assertions — if the types are wrong, TS errors.
    const open = { act: "open", strain: "notrump" } as const satisfies BidAction;
    const show = { act: "show", feature: "heldSuit", suit: "hearts" } as const satisfies BidAction;
    const deny = { act: "deny", feature: "majorSuit" } as const satisfies BidAction;
    const inquire = { act: "inquire", feature: "majorSuit" } as const satisfies BidAction;
    const transfer = { act: "transfer", targetSuit: "spades" } as const satisfies BidAction;
    const accept = { act: "accept", feature: "heldSuit", suit: "clubs" } as const satisfies BidAction;
    const decline = { act: "decline", feature: "strength" } as const satisfies BidAction;
    const raise = { act: "raise", strain: "hearts", strength: "game" } as const satisfies BidAction;
    const place = { act: "place", strain: "notrump" } as const satisfies BidAction;
    const signoff = { act: "signoff", strain: "spades" } as const satisfies BidAction;
    const force = { act: "force", level: "game" } as const satisfies BidAction;
    const agree = { act: "agree", strain: "hearts" } as const satisfies BidAction;
    const relay = { act: "relay", forced: true } as const satisfies BidAction;
    const overcall = { act: "overcall", feature: "heldSuit", suit: "spades" } as const satisfies BidAction;
    const double = { act: "double", feature: "strength" } as const satisfies BidAction;
    const pass = { act: "pass" } as const satisfies BidAction;
    const redouble = { act: "redouble", feature: "strength" } as const satisfies BidAction;

    // Runtime sanity — each produces a string via exhaustive switch
    const all: BidAction[] = [
      open, show, deny, inquire, transfer, accept, decline,
      raise, place, signoff, force, agree, relay, overcall,
      double, pass, redouble,
    ];
    for (const obs of all) {
      expect(typeof describeAct(obs)).toBe("string");
    }
  });

  it("BID_ACTION_TYPES contains all 17 act types", () => {
    expect(BID_ACTION_TYPES).toHaveLength(17);
    expect(new Set(BID_ACTION_TYPES).size).toBe(17);
  });

  it("BidActionType covers every member of BID_ACTION_TYPES", () => {
    // This is a compile-time assertion that BID_ACTION_TYPES[number] is assignable to BidActionType
    const acts: readonly BidActionType[] = BID_ACTION_TYPES;
    expect(acts.length).toBeGreaterThan(0);
  });

  it("optional fields are correctly optional", () => {
    // open without strength
    const openNoStrength = { act: "open", strain: "hearts" } as const satisfies BidAction;
    // open with strength
    const openWithStrength = { act: "open", strain: "hearts", strength: "weak" } as const satisfies BidAction;
    // show without suit
    const showNoSuit = { act: "show", feature: "suitQuality", quality: "good" } as const satisfies BidAction;
    // signoff without strain
    const signoffNoStrain = { act: "signoff" } as const satisfies BidAction;

    expect(openNoStrength.act).toBe("open");
    expect(openWithStrength.strength).toBe("weak");
    expect(showNoSuit.feature).toBe("suitQuality");
    expect(signoffNoStrain.act).toBe("signoff");
  });
});
