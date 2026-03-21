/**
 * Type-level compile-time assertions for the canonical observation ontology.
 *
 * These tests use `satisfies` to verify that each act variant has the expected
 * shape. Type errors here mean the discriminated union is malformed.
 */

import { describe, it, expect } from "vitest";
import type { CanonicalObs, ObsAct } from "../canonical-observation";
import { OBS_ACTS } from "../canonical-observation";

// ── Helper: exhaustive switch over ObsAct ─────────────────────────
function describeAct(obs: CanonicalObs): string {
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

describe("CanonicalObs type definitions", () => {
  it("each act variant satisfies CanonicalObs with correct shape", () => {
    // These are compile-time assertions — if the types are wrong, TS errors.
    const open = { act: "open", strain: "notrump" } as const satisfies CanonicalObs;
    const show = { act: "show", feature: "heldSuit", suit: "hearts" } as const satisfies CanonicalObs;
    const deny = { act: "deny", feature: "majorSuit" } as const satisfies CanonicalObs;
    const inquire = { act: "inquire", feature: "majorSuit" } as const satisfies CanonicalObs;
    const transfer = { act: "transfer", targetSuit: "spades" } as const satisfies CanonicalObs;
    const accept = { act: "accept", feature: "heldSuit", suit: "clubs" } as const satisfies CanonicalObs;
    const decline = { act: "decline", feature: "strength" } as const satisfies CanonicalObs;
    const raise = { act: "raise", strain: "hearts", strength: "game" } as const satisfies CanonicalObs;
    const place = { act: "place", strain: "notrump" } as const satisfies CanonicalObs;
    const signoff = { act: "signoff", strain: "spades" } as const satisfies CanonicalObs;
    const force = { act: "force", level: "game" } as const satisfies CanonicalObs;
    const agree = { act: "agree", strain: "hearts" } as const satisfies CanonicalObs;
    const relay = { act: "relay", forced: true } as const satisfies CanonicalObs;
    const overcall = { act: "overcall", feature: "heldSuit", suit: "spades" } as const satisfies CanonicalObs;
    const double = { act: "double", feature: "strength" } as const satisfies CanonicalObs;
    const pass = { act: "pass" } as const satisfies CanonicalObs;
    const redouble = { act: "redouble", feature: "strength" } as const satisfies CanonicalObs;

    // Runtime sanity — each produces a string via exhaustive switch
    const all: CanonicalObs[] = [
      open, show, deny, inquire, transfer, accept, decline,
      raise, place, signoff, force, agree, relay, overcall,
      double, pass, redouble,
    ];
    for (const obs of all) {
      expect(typeof describeAct(obs)).toBe("string");
    }
  });

  it("OBS_ACTS contains all 17 act types", () => {
    expect(OBS_ACTS).toHaveLength(17);
    expect(new Set(OBS_ACTS).size).toBe(17);
  });

  it("ObsAct covers every member of OBS_ACTS", () => {
    // This is a compile-time assertion that OBS_ACTS[number] is assignable to ObsAct
    const acts: readonly ObsAct[] = OBS_ACTS;
    expect(acts.length).toBeGreaterThan(0);
  });

  it("optional fields are correctly optional", () => {
    // open without strength
    const openNoStrength = { act: "open", strain: "hearts" } as const satisfies CanonicalObs;
    // open with strength
    const openWithStrength = { act: "open", strain: "hearts", strength: "weak" } as const satisfies CanonicalObs;
    // show without suit
    const showNoSuit = { act: "show", feature: "suitQuality", quality: "good" } as const satisfies CanonicalObs;
    // signoff without strain
    const signoffNoStrain = { act: "signoff" } as const satisfies CanonicalObs;

    expect(openNoStrength.act).toBe("open");
    expect(openWithStrength.strength).toBe("weak");
    expect(showNoSuit.feature).toBe("suitQuality");
    expect(signoffNoStrain.act).toBe("signoff");
  });
});
