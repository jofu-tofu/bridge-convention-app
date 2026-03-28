import { describe, it, expect } from "vitest";
import { moduleFactory as staymanFactory } from "../modules/stayman";
import { SAYC_SYSTEM_CONFIG } from "../system-config";
import { deriveBundleDealConstraints } from "../derive-deal-constraints";
import { generateDeal } from "../../../engine/deal-generator";
import { mulberry32 } from "../../../engine/seeded-rng";
import { evaluateHand, getSuitLength } from "../../../engine/hand-evaluator";
import { Seat, Suit } from "../../../engine/types";
import { SUIT_ORDER } from "../../../engine/constants";
import { ConventionCategory } from "../../core/convention-types";
import { CAP_OPENING_1NT } from "../capability-vocabulary";
import { NT_STAYMAN_ONLY_PROFILE } from "../nt-bundle/system-profile";
import type { BundleInput } from "../../core/bundle/bundle-types";

const sys = SAYC_SYSTEM_CONFIG;
const staymanModule = staymanFactory(sys);

const ntStaymanInput: BundleInput = {
  id: "nt-stayman",
  name: "Stayman",
  description: "Find a 4-4 major fit after 1NT opening",
  category: ConventionCategory.Asking,
  systemProfile: NT_STAYMAN_ONLY_PROFILE,
  memberIds: ["stayman"],
  declaredCapabilities: { [CAP_OPENING_1NT]: "active" },
};

const derived = deriveBundleDealConstraints(ntStaymanInput, [staymanModule], sys);
const constraints = derived.dealConstraints;

describe("nt-stayman deal isolation", () => {
  it("seeds 1-10 all produce Stayman-appropriate hands", () => {
    const heartsIdx = SUIT_ORDER.indexOf(Suit.Hearts);
    const spadesIdx = SUIT_ORDER.indexOf(Suit.Spades);
    for (let seed = 1; seed <= 10; seed++) {
      const rng = mulberry32(seed);
      const { deal } = generateDeal({ ...constraints, rng, seed });
      const southHand = deal.hands[Seat.South];
      const shape = getSuitLength(southHand);
      const hearts = shape[heartsIdx]!;
      const spades = shape[spadesIdx]!;
      const ev = evaluateHand(southHand);
      const hasFourMajor = hearts >= 4 || spades >= 4;
      const hasFiveMajor = hearts >= 5 || spades >= 5;
      const hasBothMajors4Plus = hearts >= 4 && spades >= 4;
      const isStayman = hasFourMajor && (!hasFiveMajor || hasBothMajors4Plus);
      expect(isStayman,
        `seed=${seed}: ${ev.hcp}HCP H:${hearts} S:${spades}`
      ).toBe(true);
    }
  });

  it("responder always has 8+ HCP", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const rng = mulberry32(seed);
      const { deal } = generateDeal({ ...constraints, rng, seed });
      const ev = evaluateHand(deal.hands[Seat.South]);
      expect(ev.hcp).toBeGreaterThanOrEqual(8);
    }
  });

  it("practitioner constraint has customCheck", () => {
    const southConstraint = constraints.seats.find(s => s.seat === Seat.South);
    expect(southConstraint?.customCheck).toBeDefined();
  });

  it("off-convention constraint has customCheck", () => {
    const offSouth = derived.offConventionConstraints?.seats.find(s => s.seat === Seat.South);
    expect(offSouth?.customCheck).toBeDefined();
  });
});
