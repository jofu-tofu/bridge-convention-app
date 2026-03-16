import { describe, it, expect } from "vitest";
import { Seat, BidSuit } from "../../../../engine/types";
import type { Call, Hand, Auction } from "../../../../engine/types";
import { hand } from "../../../../engine/__tests__/fixtures";
import { evaluateHand } from "../../../../engine/hand-evaluator";
import { buildAuction } from "../../../../engine/auction-helpers";
import type { MeaningSurface } from "../../../../core/contracts/meaning";
import type { ArbitrationResult } from "../../../../core/contracts/module-surface";
import { compareRanking, type CandidateTransform } from "../../../../core/contracts/meaning";
import { createFactCatalog } from "../../../../core/contracts/fact-catalog";
import { createSharedFactCatalog } from "../../../core/pipeline/fact-evaluator";
import { staymanFacts, transferFacts, ntResponseFacts } from "../facts";
import { INTERFERENCE_REDOUBLE_SURFACE } from "../meaning-surfaces";

// Meaning pipeline imports
import { evaluateFacts } from "../../../core/pipeline/fact-evaluator";
import { evaluateAllSurfaces } from "../../../core/pipeline/meaning-evaluator";
import {
  arbitrateMeanings,
  zipProposalsWithSurfaces,
} from "../../../core/pipeline/meaning-arbitrator";
import { getLegalCalls } from "../../../../engine/auction";
import { composeSurfaces, mergeUpstreamProvenance } from "../../../core/pipeline/surface-composer";
import {
  RESPONDER_SURFACES,
  OPENER_STAYMAN_SURFACES,
  OPENER_TRANSFER_HEARTS_SURFACES,
} from "../meaning-surfaces";

// ─── Convention-only surfaces (excluding natural NT invite/game) ─

const RESPONDER_CONVENTION_SURFACES = RESPONDER_SURFACES.filter(
  (s) => s.moduleId === "stayman" || s.moduleId === "jacoby-transfers",
);

// ─── Meaning pipeline helper ─────────────────────────────────

function runMeaningPipeline(
  h: Hand,
  auction: Auction,
  seat: Seat,
  surfaces: readonly MeaningSurface[],
): ArbitrationResult {
  const facts = evaluateFacts(h, evaluateHand(h));
  const proposals = evaluateAllSurfaces(surfaces, facts);
  const inputs = zipProposalsWithSurfaces(proposals, surfaces);
  const legalCalls = getLegalCalls(auction, seat);
  return arbitrateMeanings(inputs, { legalCalls });
}

// Transform pre-processing now uses composeSurfaces() from surface-composer.ts

function callMatches(
  call: Call,
  type: string,
  level?: number,
  strain?: BidSuit,
): boolean {
  if (call.type !== type) return false;
  if (type === "bid" && call.type === "bid") {
    if (level !== undefined && call.level !== level) return false;
    if (strain !== undefined && call.strain !== strain) return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════
// Meaning pipeline scenarios
// ═══════════════════════════════════════════════════════════════

describe("1NT Meaning Pipeline", () => {
  // ─── Scenario 1: Stayman-only hand ─────────────────────────
  it("[ref:bridgebum/stayman] scenario 1: 10 HCP 4S 4H → 2C Stayman", () => {
    const h = hand(
      "SK", "SQ", "S8", "S3",
      "HJ", "H7", "H4", "H2",
      "DA", "D5",
      "C8", "C3", "C2",
    );
    const auction = buildAuction(Seat.North, ["1NT", "P"]);

    const meaningResult = runMeaningPipeline(
      h, auction, Seat.South, RESPONDER_CONVENTION_SURFACES,
    );

    expect(meaningResult.selected).not.toBeNull();
    expect(callMatches(meaningResult.selected!.call, "bid", 2, BidSuit.Clubs)).toBe(true);
  });

  // ─── Scenario 2: Jacoby-only hand ─────────────────────────
  it("[ref:bridgebum/jacoby-transfers] scenario 2: 9 HCP 5H → 2D transfer", () => {
    const h = hand(
      "SA", "S3",
      "HK", "HQ", "H8", "H7", "H5",
      "D6", "D4", "D2",
      "C7", "C5", "C3",
    );
    const auction = buildAuction(Seat.North, ["1NT", "P"]);

    const meaningResult = runMeaningPipeline(
      h, auction, Seat.South, RESPONDER_CONVENTION_SURFACES,
    );

    expect(meaningResult.selected).not.toBeNull();
    expect(callMatches(meaningResult.selected!.call, "bid", 2, BidSuit.Diamonds)).toBe(true);
  });

  // ─── Scenario 3: Both eligible, 5H 4S ─────────────────────
  it("[policy] scenario 3: 5H 4S 10 HCP → 2D transfer wins over Stayman", () => {
    const h = hand(
      "SK", "SJ", "S8", "S3",
      "HA", "HQ", "H7", "H5", "H2",
      "D8", "D4",
      "C6", "C3",
    );
    const auction = buildAuction(Seat.North, ["1NT", "P"]);

    const meaningResult = runMeaningPipeline(
      h, auction, Seat.South, RESPONDER_CONVENTION_SURFACES,
    );

    expect(meaningResult.selected).not.toBeNull();
    expect(callMatches(meaningResult.selected!.call, "bid", 2, BidSuit.Diamonds)).toBe(true);
  });

  // ─── Scenario 4: Neither convention eligible ───────────────
  it("scenario 4: 8 HCP 3-3-3-4 → null (no convention match)", () => {
    const h = hand(
      "SK", "S8", "S3",
      "HJ", "H7", "H4",
      "DA", "D5", "D2",
      "C8", "C6", "C3", "C2",
    );
    const auction = buildAuction(Seat.North, ["1NT", "P"]);

    const meaningResult = runMeaningPipeline(
      h, auction, Seat.South, RESPONDER_CONVENTION_SURFACES,
    );

    expect(meaningResult.selected).toBeNull();
  });

  // ─── Scenario 5: 1NT-X interference ─────────────────────────

  // Shared transforms for scenario 5
  const scenario5Transforms: CandidateTransform[] = [
    { transformId: "suppress-stayman", kind: "suppress", targetId: "stayman:ask-major",
      sourceModuleId: "stayman", reason: "Stayman suppressed after opponent double" },
    { transformId: "suppress-transfer-h", kind: "suppress", targetId: "transfer:to-hearts",
      sourceModuleId: "jacoby-transfers", reason: "Transfers suppressed after opponent double" },
    { transformId: "suppress-transfer-s", kind: "suppress", targetId: "transfer:to-spades",
      sourceModuleId: "jacoby-transfers", reason: "Transfers suppressed after opponent double" },
    { transformId: "suppress-nt-invite", kind: "suppress", targetId: "bridge:nt-invite",
      sourceModuleId: "natural", reason: "NT invite suppressed after opponent double" },
    { transformId: "suppress-nt-game", kind: "suppress", targetId: "bridge:to-3nt",
      sourceModuleId: "natural", reason: "NT game suppressed after opponent double" },
    { transformId: "inject-redouble", kind: "inject", targetId: "interference:redouble-strength",
      sourceModuleId: "stayman", reason: "Redouble shows 10+ HCP after 1NT-X",
      surface: INTERFERENCE_REDOUBLE_SURFACE },
  ];

  /** [policy] After 1NT-X, responder with 10+ HCP and Stayman-like hand redoubles.
   *  All normal responder conventions suppressed; redouble-strength injected.
   *  Selection validation: pre-processed surfaces → correct result. */
  it("[policy] scenario 5a: 1NT-X selection — redouble with 10+ HCP (scaffold)", () => {
    const h = hand("SK","SQ","S8","S3","HJ","H7","H4","H2","DA","D5","C8","C3","C2");
    const auction = buildAuction(Seat.North, ["1NT", "X"]);

    const allSurfaces = [...RESPONDER_SURFACES, INTERFERENCE_REDOUBLE_SURFACE];
    const effectiveSurfaces = composeSurfaces(allSurfaces, scenario5Transforms).composedSurfaces;
    const result = runMeaningPipeline(h, auction, Seat.South, effectiveSurfaces);

    expect(result.selected).not.toBeNull();
    expect(result.selected!.call.type).toBe("redouble");
    expect(result.selected!.proposal.meaningId).toBe("interference:redouble-strength");
  });

  /** [policy] scenario 5b: End-to-end upstream composition + arbitration.
   *  composeSurfaces applies transforms upstream, arbitrateMeanings is transform-free. */
  it("[policy] scenario 5b: 1NT-X end-to-end — composeSurfaces + arbitrateMeanings", () => {
    const h = hand("SK","SQ","S8","S3","HJ","H7","H4","H2","DA","D5","C8","C3","C2");
    const auction = buildAuction(Seat.North, ["1NT", "X"]);

    // Upstream: compose surfaces with transforms
    const allSurfaces = [...RESPONDER_SURFACES, INTERFERENCE_REDOUBLE_SURFACE];
    const { composedSurfaces, appliedTransforms } = composeSurfaces(allSurfaces, scenario5Transforms);

    // Pipeline: evaluate composed surfaces
    const facts = evaluateFacts(h, evaluateHand(h));
    const proposals = evaluateAllSurfaces(composedSurfaces, facts);
    const inputs = zipProposalsWithSurfaces(proposals, composedSurfaces);
    const legalCalls = getLegalCalls(auction, Seat.South);

    const result = arbitrateMeanings(inputs, { legalCalls });

    // The composed surfaces should have suppressed 5 surfaces, keeping only the injected redouble
    expect(result.selected).not.toBeNull();
    expect(result.selected!.call.type).toBe("redouble");
    expect(result.selected!.proposal.meaningId).toBe("interference:redouble-strength");

    // Suppressed surfaces must not appear in truthSet
    const truthMeaningIds = result.truthSet.map((e) => e.proposal.meaningId);
    expect(truthMeaningIds).not.toContain("stayman:ask-major");
    expect(truthMeaningIds).not.toContain("transfer:to-hearts");
    expect(truthMeaningIds).not.toContain("transfer:to-spades");

    // Transform tracing via upstream appliedTransforms
    expect(appliedTransforms.length).toBeGreaterThan(0);
    const suppressTransforms = appliedTransforms.filter((t) => t.kind === "suppress");
    const injectTransforms = appliedTransforms.filter((t) => t.kind === "inject");
    expect(suppressTransforms.length).toBeGreaterThan(0);
    expect(injectTransforms.length).toBeGreaterThanOrEqual(0);
  });

  // ─── Scenario 6: 1NT-2S overcall ────────────────────────────

  const scenario6Transforms: CandidateTransform[] = [
    { transformId: "suppress-stayman", kind: "suppress", targetId: "stayman:ask-major",
      sourceModuleId: "stayman", reason: "Stayman off under direct overcall" },
    { transformId: "suppress-transfer-h", kind: "suppress", targetId: "transfer:to-hearts",
      sourceModuleId: "jacoby-transfers", reason: "Jacoby off under direct overcall" },
    { transformId: "suppress-transfer-s", kind: "suppress", targetId: "transfer:to-spades",
      sourceModuleId: "jacoby-transfers", reason: "Jacoby off under direct overcall" },
    { transformId: "suppress-nt-invite", kind: "suppress", targetId: "bridge:nt-invite",
      sourceModuleId: "natural", reason: "NT invite off under direct overcall" },
    { transformId: "suppress-nt-game", kind: "suppress", targetId: "bridge:to-3nt",
      sourceModuleId: "natural", reason: "NT game off under direct overcall" },
  ];

  /** [policy] After 1NT-2S overcall, conventions deactivate. No selectable candidate.
   *  Selection validation: pre-processed surfaces → null result. */
  it("[policy] scenario 6a: 1NT-2S selection — conventions suppressed (scaffold)", () => {
    const h = hand("SA","S3","HK","HQ","H8","H7","H5","D6","D4","D2","C7","C5","C3");
    const auction = buildAuction(Seat.North, ["1NT", "2S"]);

    const effectiveSurfaces = composeSurfaces(RESPONDER_SURFACES, scenario6Transforms).composedSurfaces;
    const result = runMeaningPipeline(h, auction, Seat.South, effectiveSurfaces);

    expect(result.selected).toBeNull();
    expect(result.truthSet).toHaveLength(0);
  });

  /** [policy] scenario 6b: End-to-end upstream composition + arbitration.
   *  composeSurfaces removes all surfaces, arbitrateMeanings receives empty set. */
  it("[policy] scenario 6b: 1NT-2S end-to-end — composeSurfaces suppresses all", () => {
    const h = hand("SA","S3","HK","HQ","H8","H7","H5","D6","D4","D2","C7","C5","C3");
    const auction = buildAuction(Seat.North, ["1NT", "2S"]);

    // Upstream: compose surfaces with transforms
    const { composedSurfaces, appliedTransforms } = composeSurfaces(RESPONDER_SURFACES, scenario6Transforms);

    // Pipeline: evaluate composed (empty) surfaces
    const facts = evaluateFacts(h, evaluateHand(h));
    const proposals = evaluateAllSurfaces(composedSurfaces, facts);
    const inputs = zipProposalsWithSurfaces(proposals, composedSurfaces);
    const legalCalls = getLegalCalls(auction, Seat.South);

    const result = arbitrateMeanings(inputs, { legalCalls });

    // All surfaces suppressed → null
    expect(result.selected).toBeNull();
    expect(result.truthSet).toHaveLength(0);

    // Transform tracing via upstream appliedTransforms
    expect(appliedTransforms).toHaveLength(5);
  });

  // ─── Scenario 7: Opener Stayman response ───────────────────
  it("[ref:bridgebum/stayman] scenario 7: opener 16 HCP 4S → 2S to Stayman ask", () => {
    const h = hand(
      "SA", "SK", "S5", "S2",
      "HQ", "HJ", "H3",
      "DK", "DQ", "D7",
      "CA", "C8", "C4",
    );
    const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P"]);

    const meaningResult = runMeaningPipeline(
      h, auction, Seat.North, OPENER_STAYMAN_SURFACES,
    );

    expect(meaningResult.selected).not.toBeNull();
    expect(callMatches(meaningResult.selected!.call, "bid", 2, BidSuit.Spades)).toBe(true);
  });

  // ─── Scenario 8: Opener transfer accept ────────────────────
  it("[ref:bridgebum/jacoby-transfers] scenario 8: opener accepts heart transfer → 2H", () => {
    const h = hand(
      "SA", "SQ", "S8", "S3",
      "HK", "H7", "H4", "H2",
      "DA", "DJ", "D5",
      "CQ", "C3",
    );
    const auction = buildAuction(Seat.North, ["1NT", "P", "2D", "P"]);

    const meaningResult = runMeaningPipeline(
      h, auction, Seat.North, OPENER_TRANSFER_HEARTS_SURFACES,
    );

    expect(meaningResult.selected).not.toBeNull();
    expect(callMatches(meaningResult.selected!.call, "bid", 2, BidSuit.Hearts)).toBe(true);
  });

  // ─── Scenario 9: Both conventions produce proposals ─────────
  it("scenario 9: 5-4 hand → both stayman and transfer proposals present", () => {
    // Same 5-4 hand as scenario 3: S:KJ83 H:AQ752 D:84 C:63
    const h = hand(
      "SK", "SJ", "S8", "S3",
      "HA", "HQ", "H7", "H5", "H2",
      "D8", "D4",
      "C6", "C3",
    );
    const auction = buildAuction(Seat.North, ["1NT", "P"]);

    const meaningResult = runMeaningPipeline(
      h, auction, Seat.South, RESPONDER_CONVENTION_SURFACES,
    );

    // Transfer is in truthSet (5H satisfies transfer clause)
    const transferInTruth = meaningResult.truthSet.find(
      (e) => e.proposal.moduleId === "jacoby-transfers",
    );
    expect(transferInTruth).toBeDefined();

    // Stayman is in acceptableSet — it has 4-card major and 8+ HCP but
    // fails "no 5-card major" clause (hand has 5H), so it's not fully satisfied
    // but still legal and "should"-band, so the arbitrator keeps it as acceptable
    const staymanInAcceptable = meaningResult.acceptableSet.find(
      (e) => e.proposal.moduleId === "stayman",
    );
    expect(staymanInAcceptable).toBeDefined();

    // Combined: both conventions produced proposals
    const allProposals = [...meaningResult.truthSet, ...meaningResult.acceptableSet];
    const moduleIds = new Set(allProposals.map((e) => e.proposal.moduleId));
    expect(moduleIds.has("stayman")).toBe(true);
    expect(moduleIds.has("jacoby-transfers")).toBe(true);
  });

  // ─── Scenario 10: 5-5 majors → transfer to spades ─────────
  it("[policy] scenario 10: 5-5 majors 9 HCP → 2H transfer to spades", () => {
    const h = hand(
      "SK", "SQ", "S7", "S5", "S3",
      "HA", "HJ", "H8", "H4", "H2",
      "D5",
      "C6", "C3",
    );
    const auction = buildAuction(Seat.North, ["1NT", "P"]);

    const meaningResult = runMeaningPipeline(
      h, auction, Seat.South, RESPONDER_CONVENTION_SURFACES,
    );

    expect(meaningResult.selected).not.toBeNull();
    expect(callMatches(meaningResult.selected!.call, "bid", 2, BidSuit.Hearts)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Fact evaluation correctness
// ═══════════════════════════════════════════════════════════════

describe("Fact evaluation correctness", () => {
  it("evaluates all seed primitive facts for a known hand", () => {
    // S:KQ83 H:J742 D:A5 C:832 — 10 HCP, 4S, 4H, 2D, 3C
    const h = hand("SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2", "DA", "D5", "C8", "C3", "C2");
    const facts = evaluateFacts(h, evaluateHand(h));

    expect(facts.facts.get("hand.hcp")?.value).toBe(10);
    expect(facts.facts.get("hand.suitLength.spades")?.value).toBe(4);
    expect(facts.facts.get("hand.suitLength.hearts")?.value).toBe(4);
    expect(facts.facts.get("hand.suitLength.diamonds")?.value).toBe(2);
    expect(facts.facts.get("hand.suitLength.clubs")?.value).toBe(3);
    expect(facts.facts.get("hand.isBalanced")?.value).toBe(true);
  });

  it("evaluates all bridge-derived facts for a known hand", () => {
    // S:KQ83 H:J742 D:A5 C:832 — 10 HCP, 4S, 4H
    const h = hand("SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2", "DA", "D5", "C8", "C3", "C2");
    const facts = evaluateFacts(h, evaluateHand(h));

    expect(facts.facts.get("bridge.hasFourCardMajor")?.value).toBe(true);
    expect(facts.facts.get("bridge.hasFiveCardMajor")?.value).toBe(false);
    expect(facts.facts.get("bridge.majorPattern")?.value).toBe("both-four");
    // 1NT-specific value facts moved to module.ntResponse.* (not in shared catalog)
    expect(facts.facts.has("bridge.inviteValuesOpposite1NT")).toBe(false);
    expect(facts.facts.has("bridge.gameValuesOpposite1NT")).toBe(false);
    expect(facts.facts.has("bridge.slamValuesOpposite1NT")).toBe(false);
  });

  it("evaluates ntResponse value facts via module extension", () => {
    // S:KQ83 H:J742 D:A5 C:832 — 10 HCP, 4S, 4H
    const h = hand("SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2", "DA", "D5", "C8", "C3", "C2");
    const catalog = createFactCatalog(createSharedFactCatalog(), staymanFacts, transferFacts, ntResponseFacts);
    const facts = evaluateFacts(h, evaluateHand(h), catalog);

    expect(facts.facts.get("module.ntResponse.inviteValues")?.value).toBe(false);
    expect(facts.facts.get("module.ntResponse.gameValues")?.value).toBe(true);
    expect(facts.facts.get("module.ntResponse.slamValues")?.value).toBe(false);
  });

  it("evaluates module facts when catalog extension is provided", () => {
    const h = hand("SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2", "DA", "D5", "C8", "C3", "C2");
    const catalog = createFactCatalog(createSharedFactCatalog(), staymanFacts, transferFacts);
    const facts = evaluateFacts(h, evaluateHand(h), catalog);

    // Stayman module facts
    expect(facts.facts.get("module.stayman.eligible")?.value).toBe(true);
    expect(facts.facts.get("module.stayman.preferred")?.value).toBe(true);
    // Transfer module facts (no 5-card major → not eligible)
    expect(facts.facts.get("module.transfer.eligible")?.value).toBe(false);
    expect(facts.facts.get("module.transfer.targetSuit")?.value).toBe("none");
  });

  it("evaluates world as acting-hand", () => {
    const h = hand("SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2", "DA", "D5", "C8", "C3", "C2");
    const facts = evaluateFacts(h, evaluateHand(h));
    expect(facts.world).toBe("acting-hand");
  });
});

// ═══════════════════════════════════════════════════════════════
// Surface evaluation
// ═══════════════════════════════════════════════════════════════

describe("Surface evaluation", () => {
  it("evaluates responder surfaces — Stayman clauses for a 4-4 major hand", () => {
    // 10 HCP, 4S 4H → Stayman satisfied
    const h = hand("SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2", "DA", "D5", "C8", "C3", "C2");
    const facts = evaluateFacts(h, evaluateHand(h));
    const proposals = evaluateAllSurfaces(RESPONDER_SURFACES, facts);

    // Find the Stayman proposal
    const staymanProposal = proposals.find((p) => p.meaningId === "stayman:ask-major");
    expect(staymanProposal).toBeDefined();
    // All clauses satisfied for this hand
    expect(staymanProposal!.clauses.every((c) => c.satisfied)).toBe(true);
  });

  it("evaluates transfer surface — hearts clause for a 5H hand", () => {
    // 9 HCP, 5H → transfer satisfied
    const h = hand("SA", "S3", "HK", "HQ", "H8", "H7", "H5", "D6", "D4", "D2", "C7", "C5", "C3");
    const facts = evaluateFacts(h, evaluateHand(h));
    const proposals = evaluateAllSurfaces(RESPONDER_SURFACES, facts);

    const transferProposal = proposals.find((p) => p.meaningId === "transfer:to-hearts");
    expect(transferProposal).toBeDefined();
    expect(transferProposal!.clauses.every((c) => c.satisfied)).toBe(true);
  });

  it("evaluates opener Stayman surfaces — show hearts when 4+ hearts", () => {
    // Opener: 4H → show hearts satisfied
    const h = hand("SA", "SK", "S5", "S2", "HQ", "HJ", "H7", "H3", "DK", "DQ", "D7", "CA", "C4");
    const facts = evaluateFacts(h, evaluateHand(h));
    const proposals = evaluateAllSurfaces(OPENER_STAYMAN_SURFACES, facts);

    const showHearts = proposals.find((p) => p.meaningId === "stayman:show-hearts");
    expect(showHearts).toBeDefined();
    expect(showHearts!.clauses.every((c) => c.satisfied)).toBe(true);
  });

  it("evaluates opener transfer accept — no clauses, always satisfied", () => {
    const h = hand("SA", "SQ", "S8", "S3", "HK", "H7", "H4", "H2", "DA", "DJ", "D5", "CQ", "C3");
    const facts = evaluateFacts(h, evaluateHand(h));
    const proposals = evaluateAllSurfaces(OPENER_TRANSFER_HEARTS_SURFACES, facts);

    const accept = proposals.find((p) => p.meaningId === "transfer:accept");
    expect(accept).toBeDefined();
    // No clauses → trivially satisfied
    expect(accept!.clauses).toHaveLength(0);
  });

  it("surfaces produce correct provenance origin", () => {
    const h = hand("SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2", "DA", "D5", "C8", "C3", "C2");
    const facts = evaluateFacts(h, evaluateHand(h));
    const proposals = evaluateAllSurfaces(RESPONDER_SURFACES, facts);

    for (const p of proposals) {
      expect(p.evidence.provenance.origin).toBe("tree");
      expect(p.evidence.provenance.moduleId).toBeTruthy();
      expect(p.evidence.provenance.nodeName).toBe(p.meaningId);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Arbitration: truthSet, acceptableSet, recommended ordering
// ═══════════════════════════════════════════════════════════════

describe("Arbitration sets and ordering", () => {
  it("truthSet contains only fully satisfied, legal candidates", () => {
    // 10 HCP, 4S 4H → Stayman only (no 5M)
    const h = hand("SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2", "DA", "D5", "C8", "C3", "C2");
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = runMeaningPipeline(h, auction, Seat.South, RESPONDER_CONVENTION_SURFACES);

    for (const entry of result.truthSet) {
      expect(entry.eligibility.hand.satisfied).toBe(true);
      expect(entry.eligibility.encoding.legal).toBe(true);
    }
  });

  it("acceptableSet contains candidates with unsatisfied clauses but legal encoding", () => {
    // 5H 4S → transfer is truth, stayman is acceptable (has 5M, violates no-5M clause)
    const h = hand("SK", "SJ", "S8", "S3", "HA", "HQ", "H7", "H5", "H2", "D8", "D4", "C6", "C3");
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = runMeaningPipeline(h, auction, Seat.South, RESPONDER_CONVENTION_SURFACES);

    for (const entry of result.acceptableSet) {
      expect(entry.eligibility.hand.satisfied).toBe(false);
      expect(entry.eligibility.encoding.legal).toBe(true);
    }
  });

  it("recommended is sorted by ranking (best first)", () => {
    // Both Stayman and transfer produce truth proposals for 5H 4S 10 HCP hand
    const h = hand("SK", "SJ", "S8", "S3", "HA", "HQ", "H7", "H5", "H2", "D8", "D4", "C6", "C3");
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = runMeaningPipeline(h, auction, Seat.South, RESPONDER_CONVENTION_SURFACES);

    // Recommended should be in ranking order
    for (let i = 1; i < result.recommended.length; i++) {
      const cmp = compareRanking(
        result.recommended[i - 1]!.proposal.ranking,
        result.recommended[i]!.proposal.ranking,
      );
      expect(cmp).toBeLessThanOrEqual(0);
    }
  });

  it("selected matches the first element of recommended", () => {
    const h = hand("SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2", "DA", "D5", "C8", "C3", "C2");
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = runMeaningPipeline(h, auction, Seat.South, RESPONDER_CONVENTION_SURFACES);

    expect(result.selected).not.toBeNull();
    expect(result.recommended.length).toBeGreaterThan(0);
    expect(result.selected!.proposal.meaningId).toBe(result.recommended[0]!.proposal.meaningId);
  });
});

// ═══════════════════════════════════════════════════════════════
// Provenance population
// ═══════════════════════════════════════════════════════════════

describe("Provenance population", () => {
  it("every elimination has a provenance trace", () => {
    // 8 HCP, no majors → all convention surfaces eliminated
    const h = hand("SK", "S8", "S3", "HJ", "H7", "H4", "DA", "D5", "D2", "C8", "C6", "C3", "C2");
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = runMeaningPipeline(h, auction, Seat.South, RESPONDER_CONVENTION_SURFACES);

    expect(result.provenance).toBeDefined();
    expect(result.provenance!.eliminations.length).toBeGreaterThan(0);
    for (const elim of result.provenance!.eliminations) {
      expect(elim.candidateId).toBeTruthy();
      expect(elim.stage).toBeTruthy();
      expect(elim.reason).toBeTruthy();
    }
  });

  it("selected candidate has arbitration trace", () => {
    const h = hand("SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2", "DA", "D5", "C8", "C3", "C2");
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = runMeaningPipeline(h, auction, Seat.South, RESPONDER_CONVENTION_SURFACES);

    expect(result.provenance).toBeDefined();
    expect(result.provenance!.arbitration.length).toBeGreaterThan(0);

    // Find the selected candidate's arbitration trace
    const selectedTrace = result.provenance!.arbitration.find(
      (t) => t.candidateId === result.selected!.proposal.meaningId,
    );
    expect(selectedTrace).toBeDefined();
    expect(selectedTrace!.truthSetMember).toBe(true);
    expect(selectedTrace!.recommendationRank).toBe(0);
  });

  it("transform traces appear in provenance via mergeUpstreamProvenance", () => {
    const h = hand("SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2", "DA", "D5", "C8", "C3", "C2");
    const auction = buildAuction(Seat.North, ["1NT", "X"]);

    const interferenceTransforms: CandidateTransform[] = [
      { transformId: "s1", kind: "suppress", targetId: "stayman:ask-major",
        sourceModuleId: "stayman", reason: "Stayman suppressed after double" },
      { transformId: "s2", kind: "suppress", targetId: "transfer:to-hearts",
        sourceModuleId: "jacoby-transfers", reason: "Transfer suppressed after double" },
      { transformId: "s3", kind: "suppress", targetId: "transfer:to-spades",
        sourceModuleId: "jacoby-transfers", reason: "Transfer suppressed after double" },
      { transformId: "s4", kind: "suppress", targetId: "bridge:nt-invite",
        sourceModuleId: "natural", reason: "NT invite suppressed after double" },
      { transformId: "s5", kind: "suppress", targetId: "bridge:to-3nt",
        sourceModuleId: "natural", reason: "NT game suppressed after double" },
      { transformId: "i1", kind: "inject", targetId: "interference:redouble-strength",
        sourceModuleId: "stayman", reason: "Redouble shows 10+ HCP",
        surface: INTERFERENCE_REDOUBLE_SURFACE },
    ];

    // Upstream: compose surfaces
    const allSurfaces = [...RESPONDER_SURFACES, INTERFERENCE_REDOUBLE_SURFACE];
    const { composedSurfaces, appliedTransforms } = composeSurfaces(allSurfaces, interferenceTransforms);

    // Pipeline: evaluate composed surfaces
    const facts = evaluateFacts(h, evaluateHand(h));
    const proposals = evaluateAllSurfaces(composedSurfaces, facts);
    const inputs = zipProposalsWithSurfaces(proposals, composedSurfaces);
    const legalCalls = getLegalCalls(auction, Seat.South);
    const arbitration = arbitrateMeanings(inputs, { legalCalls });

    // Graft upstream provenance
    const result = mergeUpstreamProvenance(arbitration, appliedTransforms);

    expect(result.provenance).toBeDefined();
    expect(result.provenance!.transforms.length).toBeGreaterThan(0);
    // Every suppress transform has a trace
    const suppressTraces = result.provenance!.transforms.filter((t) => t.kind === "suppress");
    expect(suppressTraces.length).toBeGreaterThanOrEqual(5);
  });

  it("provenance has encoding traces for all evaluated candidates", () => {
    const h = hand("SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2", "DA", "D5", "C8", "C3", "C2");
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = runMeaningPipeline(h, auction, Seat.South, RESPONDER_CONVENTION_SURFACES);

    expect(result.provenance).toBeDefined();
    // Should have encoding traces for each evaluated surface
    expect(result.provenance!.encoding.length).toBeGreaterThan(0);
    for (const enc of result.provenance!.encoding) {
      expect(enc.encoderKind).toBe("default-call");
      expect(enc.consideredCalls.length).toBeGreaterThan(0);
    }
  });

  it("provenance has legality traces for all evaluated candidates", () => {
    const h = hand("SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2", "DA", "D5", "C8", "C3", "C2");
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = runMeaningPipeline(h, auction, Seat.South, RESPONDER_CONVENTION_SURFACES);

    expect(result.provenance).toBeDefined();
    expect(result.provenance!.legality.length).toBeGreaterThan(0);
    for (const leg of result.provenance!.legality) {
      expect(leg.call).toBeDefined();
      expect(typeof leg.legal).toBe("boolean");
    }
  });

  it("provenance applicability has fact dependencies and conditions for selected", () => {
    const h = hand("SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2", "DA", "D5", "C8", "C3", "C2");
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = runMeaningPipeline(h, auction, Seat.South, RESPONDER_CONVENTION_SURFACES);

    expect(result.provenance).toBeDefined();
    expect(result.provenance!.applicability.factDependencies.length).toBeGreaterThan(0);
    expect(result.provenance!.applicability.evaluatedConditions.length).toBeGreaterThan(0);
    for (const cond of result.provenance!.applicability.evaluatedConditions) {
      expect(cond.conditionId).toBeTruthy();
      expect(cond.satisfied).toBe(true); // Selected candidate has all conditions satisfied
    }
  });
});
