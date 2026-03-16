// Partner interpretation model — what will partner infer if we make this bid?
// Lives in inference/ because it runs hypothetical inferFromBid() calls.

import type { Call, Seat, Auction, AuctionEntry } from "../engine/types";
import type { InferenceProvider } from "./types";
import type { SuitInference } from "../core/contracts";

/** What partner would infer from a candidate bid, and how well our actual hand matches. */
interface PartnerInterpretationDTO {
  readonly publicMeaning: string;
  readonly partnerExpectedHcp: { readonly min: number; readonly max: number };
  readonly partnerExpectedSuits: Partial<Record<string, { readonly min: number; readonly max: number }>>;
  readonly misunderstandingRisk: number;     // 0-1
  readonly continuationAwkwardness: number;  // 0-1
}

/** Shape order: [spades, hearts, diamonds, clubs] — matches evaluation.shape convention. */
const SUIT_INDEX: Record<string, number> = {
  S: 0,
  H: 1,
  D: 2,
  C: 3,
};

/**
 * Compute what partner would infer from a candidate bid, and how well
 * our actual hand matches those expectations.
 *
 * When inferFromBid returns null: fail-open (risk=0, awkwardness=0).
 */
export function computePartnerInterpretation(
  candidateCall: Call,
  auctionBefore: Auction,
  seat: Seat,
  actualHand: { readonly hcp: number; readonly shape: readonly number[] },
  inferenceProvider: InferenceProvider,
): PartnerInterpretationDTO {
  // Build hypothetical auction entry for inference
  const entry: AuctionEntry = { seat, call: candidateCall };

  let inference;
  try {
    inference = inferenceProvider.inferFromBid(entry, auctionBefore, seat);
  } catch {
    inference = null;
  }

  if (!inference) {
    return {
      publicMeaning: "",
      partnerExpectedHcp: { min: 0, max: 40 },
      partnerExpectedSuits: {},
      misunderstandingRisk: 0,
      continuationAwkwardness: 0,
    };
  }

  const expectedMin = inference.minHcp ?? 0;
  const expectedMax = inference.maxHcp ?? 40;
  const partnerExpectedHcp = { min: expectedMin, max: expectedMax };

  // Map suit inferences to expected ranges
  const partnerExpectedSuits: Partial<Record<string, { min: number; max: number }>> = {};
  for (const [suit, si] of Object.entries(inference.suits)) {
    if (!si) continue;
    partnerExpectedSuits[suit] = {
      min: si.minLength ?? 0,
      max: si.maxLength ?? 13,
    };
  }

  // misunderstandingRisk: how far is our actual HCP from what partner expects?
  const misunderstandingRisk = computeHcpRisk(actualHand.hcp, expectedMin, expectedMax);

  // continuationAwkwardness: how far are our suit lengths from what partner expects?
  const continuationAwkwardness = computeSuitAwkwardness(actualHand.shape, inference.suits);

  return {
    publicMeaning: inference.source,
    partnerExpectedHcp,
    partnerExpectedSuits,
    misunderstandingRisk,
    continuationAwkwardness,
  };
}

function computeHcpRisk(actualHcp: number, expectedMin: number, expectedMax: number): number {
  const range = expectedMax - expectedMin;
  if (range === 0) {
    return actualHcp === expectedMin ? 0 : 1;
  }
  const midpoint = (expectedMin + expectedMax) / 2;
  const deviation = Math.abs(actualHcp - midpoint);
  const normalized = deviation / range;
  return Math.min(1, Math.max(0, normalized));
}

function computeSuitAwkwardness(
  shape: readonly number[],
  suitExpectations: Partial<Record<string, SuitInference>>,
): number {
  const entries = Object.entries(suitExpectations).filter(
    (entry): entry is [string, SuitInference] => entry[1] !== undefined,
  );
  if (entries.length === 0) return 0;

  let totalShortfall = 0;
  let suitCount = 0;

  for (const [suit, si] of entries) {
    const expectedMin = si.minLength ?? 0;
    if (expectedMin === 0) continue; // No minimum expectation — skip

    const suitIdx = SUIT_INDEX[suit];
    if (suitIdx === undefined) continue;

    const actualLength = shape[suitIdx] ?? 0;
    const shortfall = Math.max(0, expectedMin - actualLength) / 13;
    totalShortfall += shortfall;
    suitCount++;
  }

  if (suitCount === 0) return 0;
  return Math.min(1, Math.max(0, totalShortfall / suitCount));
}
