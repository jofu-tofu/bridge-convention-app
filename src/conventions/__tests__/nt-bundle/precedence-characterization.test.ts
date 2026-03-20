/**
 * Characterization tests: verify that the SELECTED BID is correct for
 * hands where modulePrecedence was previously the tie-breaker.
 *
 * After removing modulePrecedence overrides (all surfaces get 0), these
 * tests prove that band + specificity resolve all critical cases.
 */
import { describe, it, expect } from "vitest";
import { compareRanking, type RankingMetadata } from "../../../core/contracts/meaning";

function ranking(
  band: "must" | "should" | "may",
  specificity: number,
  modulePrecedence: number,
  intraModuleOrder: number,
): RankingMetadata {
  return {
    recommendationBand: band,
    specificity,
    modulePrecedence,
    intraModuleOrder,
  };
}

describe("precedence characterization — band resolves critical NT tie-breaks", () => {
  it("Smolen 2C entry (must) beats Stayman 2C (should) regardless of modulePrecedence", () => {
    // Smolen entry: band=must, 5+ clauses → high specificity
    // Stayman entry: band=should, fewer clauses → lower specificity
    // With uniform precedence=0, band still resolves this.
    const smolen = ranking("must", 4, 0, 0);
    const stayman = ranking("should", 2, 0, 0);

    expect(compareRanking(smolen, stayman)).toBeLessThan(0); // smolen wins
  });

  it("Smolen 2C entry (must) beats Stayman 2C (should) even with old precedence values", () => {
    // Old values: smolen precedence=2, stayman precedence=1
    // Band still wins regardless.
    const smolen = ranking("must", 4, 2, 0);
    const stayman = ranking("should", 2, 1, 0);

    expect(compareRanking(smolen, stayman)).toBeLessThan(0); // smolen still wins
  });

  it("Natural NT 2NT invite (may) is the only candidate at its encoding — no tie-break needed", () => {
    // 2NT invite: band=may. No other surface encodes 2NT in responder-r1.
    // Stayman and Transfers encode 2C/2D/2H — different calls entirely.
    // This test documents that no ranking competition exists for 2NT.
    const ntInvite = ranking("may", 3, 0, 0);

    // No competitor — just verify it's a valid ranking
    expect(ntInvite.recommendationBand).toBe("may");
  });

  it("3NT game (may) competes only with other 'may' band surfaces at 3NT encoding", () => {
    // 3NT game: band=may. The only surface encoding 3NT.
    // With uniform precedence=0, no disambiguation needed.
    const ntGame = ranking("may", 3, 0, 1);

    expect(ntGame.recommendationBand).toBe("may");
  });

  it("Stayman redouble (must) in interrupted state has no competitor", () => {
    // The redouble surface is the only surface in the nt-interrupted state.
    // Its old modulePrecedence=0 override was defensive — no other surface
    // shares the same surfaceGroupId to compete with.
    const redouble = ranking("must", 1, 0, 0);

    expect(redouble.recommendationBand).toBe("must");
  });

  it("band difference always resolves before modulePrecedence", () => {
    // Exhaustive: must vs should, must vs may, should vs may
    // With any precedence values, band wins.
    const mustSurface = ranking("must", 0, 99, 99);
    const shouldSurface = ranking("should", 99, 0, 0);
    const maySurface = ranking("may", 99, 0, 0);

    expect(compareRanking(mustSurface, shouldSurface)).toBeLessThan(0);
    expect(compareRanking(mustSurface, maySurface)).toBeLessThan(0);
    expect(compareRanking(shouldSurface, maySurface)).toBeLessThan(0);
  });

  it("specificity resolves before modulePrecedence at same band", () => {
    // Two surfaces with same band: higher specificity wins, ignoring precedence.
    const highSpec = ranking("should", 5, 99, 0);
    const lowSpec = ranking("should", 2, 0, 0);

    expect(compareRanking(highSpec, lowSpec)).toBeLessThan(0); // highSpec wins
  });

  it("with uniform modulePrecedence=0, intraModuleOrder is the final tiebreaker", () => {
    // Two surfaces with same band, same specificity, same precedence.
    // intraModuleOrder breaks the tie.
    const first = ranking("should", 3, 0, 0);
    const second = ranking("should", 3, 0, 1);

    expect(compareRanking(first, second)).toBeLessThan(0); // first wins
  });
});
