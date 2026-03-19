import { describe, it, expect } from "vitest";
import { BidSuit } from "../../engine/types";
import type { Call } from "../../engine/types";
import { buildCallViews } from "../call-view-builder";
import type {
  ArbitrationResult,
  EncodedProposal,
} from "../../core/contracts/module-surface";

import {
  makeCall,
  makeRankingMetadata as makeRanking,
  makeClause,
  makeProposal,
  makeEligibility,
  makeEncoded,
  makeArbitration,
} from "../../test-support/convention-factories";

// -- Tests --

describe("buildCallViews", () => {
  it("single truth-set entry produces a single view with status 'truth' and 'single-rationale'", () => {
    const encoded = makeEncoded({
      proposal: makeProposal({ meaningId: "stayman:ask-major" }),
      call: makeCall(2, BidSuit.Clubs),
    });
    const arbitration = makeArbitration({ truthSet: [encoded] });

    const views = buildCallViews(arbitration);

    expect(views).toHaveLength(1);
    expect(views[0]!.status).toBe("truth");
    expect(views[0]!.projectionKind).toBe("single-rationale");
    expect(views[0]!.supportingMeanings).toEqual(["stayman:ask-major"]);
    expect(views[0]!.primaryMeaning).toBe("stayman:ask-major");
  });

  it("multiple truth-set entries with same call and same semanticClassId produce 'merged-equivalent'", () => {
    const call = makeCall(2, BidSuit.NoTrump);
    const encoded1 = makeEncoded({
      proposal: makeProposal({
        meaningId: "nt:invite-a",
        semanticClassId: "bridge:nt-invite",
      }),
      call,
    });
    const encoded2 = makeEncoded({
      proposal: makeProposal({
        meaningId: "nt:invite-b",
        semanticClassId: "bridge:nt-invite",
      }),
      call,
    });
    const arbitration = makeArbitration({ truthSet: [encoded1, encoded2] });

    const views = buildCallViews(arbitration);

    expect(views).toHaveLength(1);
    expect(views[0]!.projectionKind).toBe("merged-equivalent");
    expect(views[0]!.supportingMeanings).toContain("nt:invite-a");
    expect(views[0]!.supportingMeanings).toContain("nt:invite-b");
    expect(views[0]!.status).toBe("truth");
  });

  it("multiple truth-set entries with same call but different semanticClassIds produce 'multi-rationale-same-call'", () => {
    const call = makeCall(2, BidSuit.NoTrump);
    const encoded1 = makeEncoded({
      proposal: makeProposal({
        meaningId: "nt:quantitative-invite",
        semanticClassId: "bridge:nt-invite",
      }),
      call,
    });
    const encoded2 = makeEncoded({
      proposal: makeProposal({
        meaningId: "stayman:stopper-probe",
        semanticClassId: "stayman:stopper-probe",
      }),
      call,
    });
    const arbitration = makeArbitration({ truthSet: [encoded1, encoded2] });

    const views = buildCallViews(arbitration);

    expect(views).toHaveLength(1);
    expect(views[0]!.projectionKind).toBe("multi-rationale-same-call");
    expect(views[0]!.supportingMeanings).toHaveLength(2);
    expect(views[0]!.status).toBe("truth");
  });

  it("acceptable-set entries NOT in truth set produce status 'acceptable'", () => {
    const truthEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "nt:game-raise" }),
      call: makeCall(3, BidSuit.NoTrump),
    });
    const acceptableEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "nt:invite" }),
      call: makeCall(2, BidSuit.NoTrump),
    });
    const arbitration = makeArbitration({
      truthSet: [truthEncoded],
      acceptableSet: [acceptableEncoded],
    });

    const views = buildCallViews(arbitration);

    expect(views).toHaveLength(2);
    const truthView = views.find(v => v.status === "truth");
    const acceptableView = views.find(v => v.status === "acceptable");
    expect(truthView).toBeDefined();
    expect(acceptableView).toBeDefined();
    expect(acceptableView!.supportingMeanings).toEqual(["nt:invite"]);
  });

  it("acceptable-set entries with same call as truth set are filtered out (truth wins)", () => {
    const call = makeCall(2, BidSuit.Clubs);
    const truthEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "stayman:ask-major" }),
      call,
    });
    const acceptableEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "stayman:variant" }),
      call,
    });
    const arbitration = makeArbitration({
      truthSet: [truthEncoded],
      acceptableSet: [acceptableEncoded],
    });

    const views = buildCallViews(arbitration);

    expect(views).toHaveLength(1);
    expect(views[0]!.status).toBe("truth");
    expect(views[0]!.supportingMeanings).toEqual(["stayman:ask-major"]);
  });

  it("empty truth set and empty acceptable set produce empty array", () => {
    const arbitration = makeArbitration({
      truthSet: [],
      acceptableSet: [],
    });

    const views = buildCallViews(arbitration);

    expect(views).toEqual([]);
  });

  it("primary meaning is selected alphabetically by meaningId", () => {
    const call = makeCall(2, BidSuit.Clubs);
    const encodedZ = makeEncoded({
      proposal: makeProposal({
        meaningId: "z-meaning",
        semanticClassId: "bridge:same",
      }),
      call,
    });
    const encodedA = makeEncoded({
      proposal: makeProposal({
        meaningId: "a-meaning",
        semanticClassId: "bridge:same",
      }),
      call,
    });
    // Insert z before a to verify sorting is by meaningId, not insertion order
    const arbitration = makeArbitration({ truthSet: [encodedZ, encodedA] });

    const views = buildCallViews(arbitration);

    expect(views).toHaveLength(1);
    expect(views[0]!.primaryMeaning).toBe("a-meaning");
  });

  it("non-bid calls (pass, double) are grouped correctly by call type", () => {
    const passCall: Call = { type: "pass" };
    const doubleCall: Call = { type: "double" };
    const passEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "natural:pass" }),
      call: passCall,
    });
    const doubleEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "penalty:double" }),
      call: doubleCall,
    });
    const arbitration = makeArbitration({
      truthSet: [passEncoded, doubleEncoded],
    });

    const views = buildCallViews(arbitration);

    expect(views).toHaveLength(2);
    const passView = views.find(v => v.call.type === "pass");
    const doubleView = views.find(v => v.call.type === "double");
    expect(passView).toBeDefined();
    expect(doubleView).toBeDefined();
    expect(passView!.status).toBe("truth");
    expect(doubleView!.status).toBe("truth");
    expect(passView!.projectionKind).toBe("single-rationale");
    expect(doubleView!.projectionKind).toBe("single-rationale");
  });

  it("two pass entries in truth set are grouped as one merged view", () => {
    const passCall: Call = { type: "pass" };
    const pass1 = makeEncoded({
      proposal: makeProposal({
        meaningId: "natural:pass",
        semanticClassId: "bridge:pass",
      }),
      call: passCall,
    });
    const pass2 = makeEncoded({
      proposal: makeProposal({
        meaningId: "forced:pass",
        semanticClassId: "bridge:pass",
      }),
      call: passCall,
    });
    const arbitration = makeArbitration({ truthSet: [pass1, pass2] });

    const views = buildCallViews(arbitration);

    expect(views).toHaveLength(1);
    expect(views[0]!.call.type).toBe("pass");
    expect(views[0]!.projectionKind).toBe("merged-equivalent");
    expect(views[0]!.supportingMeanings).toHaveLength(2);
  });
});
