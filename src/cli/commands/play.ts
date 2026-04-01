// ── CLI play command ────────────────────────────────────────────────
//
// Session-based playthrough. Uses the same session API as the UI:
// createSession → startDrill → submitBid loop. Stateless: each
// invocation creates a fresh session (same seed = same deal).

import type { DevServicePort } from "../../service";
import { ViewportBidGrade } from "../../service/response-types";
import type { SessionConfig } from "../../service/request-types";
import { PlayPreference } from "../../service/session-types";
import type { Flags } from "../shared";
import {
  requireArg, optionalNumericArg, parseCallString,
  parseVulnerability, parseOpponentMode, parseBaseSystem,
  parsePracticeMode, parsePracticeRole,
} from "../shared";

export async function runPlay(service: DevServicePort, flags: Flags): Promise<void> {
  const bundleId = requireArg(flags, "bundle");
  const seed = optionalNumericArg(flags, "seed") ?? 42;
  const system = parseBaseSystem(flags);
  const vuln = parseVulnerability(flags);
  const opponents = parseOpponentMode(flags);
  const mode = parsePracticeMode(flags);
  const role = parsePracticeRole(flags);
  const moduleId = typeof flags["module"] === "string" ? flags["module"] : undefined;

  const bidStr = typeof flags["bid"] === "string" ? flags["bid"] : undefined;
  const bidsStr = typeof flags["bids"] === "string" ? flags["bids"] : undefined;

  if (bidStr && bidsStr) {
    console.error("Cannot use both --bid and --bids");
    process.exit(2);
  }

  // Build the bid list: either single bid, multiple bids, or none (viewport only)
  const userBids = bidsStr
    ? bidsStr.split(",").map((s) => s.trim()).filter(Boolean)
    : bidStr
      ? [bidStr]
      : [];

  // Create session config
  const config: SessionConfig = {
    conventionId: bundleId,
    seed,
    baseSystemId: system,
    vulnerability: vuln,
    opponentMode: opponents,
    practiceMode: mode,
    targetModuleId: moduleId,
    practiceRole: role,
    playPreference: PlayPreference.Skip, // always skip to review after bidding
  };

  // Create session + start drill
  const handle = await service.createSession(config);
  const drillResult = await service.startDrill(handle);

  // No bids requested — return the initial viewport
  if (userBids.length === 0) {
    const vp = drillResult.viewport;
    console.log(JSON.stringify({
      seat: vp.seat,
      hand: vp.hand,
      hcp: vp.handEvaluation?.hcp ?? null,
      handSummary: vp.handSummary,
      auction: vp.auctionEntries,
      legalCalls: vp.legalCalls,
      conventionName: vp.conventionName,
      isUserTurn: vp.isUserTurn,
      bidContext: vp.bidContext,
      auctionComplete: drillResult.auctionComplete,
    }, null, 2));
    return;
  }

  // Submit bids in sequence
  for (let i = 0; i < userBids.length; i++) {
    const call = parseCallString(userBids[i]!);
    const result = await service.submitBid(handle, call);
    const isLast = i === userBids.length - 1;

    if (isLast) {
      // Output the grade result for the final bid
      const output: Record<string, unknown> = {
        yourBid: userBids[i],
        grade: result.grade,
        correct: result.grade === ViewportBidGrade.Correct,
        acceptable: result.grade === ViewportBidGrade.Acceptable,
        feedback: result.feedback,
        teaching: result.teaching,
        auctionComplete: result.phaseTransition !== null,
      };

      if (result.nextViewport && !result.phaseTransition) {
        output.nextViewport = {
          seat: result.nextViewport.seat,
          hand: result.nextViewport.hand,
          hcp: result.nextViewport.handEvaluation?.hcp ?? null,
          handSummary: result.nextViewport.handSummary,
          auction: result.nextViewport.auctionEntries,
          legalCalls: result.nextViewport.legalCalls,
          isUserTurn: result.nextViewport.isUserTurn,
          bidContext: result.nextViewport.bidContext,
        };
      }

      if (result.aiBids.length > 0) {
        output.aiBids = result.aiBids.map((ab) => ({
          seat: ab.seat,
          call: ab.call,
        }));
      }

      console.log(JSON.stringify(output, null, 2));

      // Exit code based on grade
      const isCorrect = result.grade === ViewportBidGrade.Correct || result.grade === ViewportBidGrade.Acceptable;
      process.exit(isCorrect ? 0 : 1);
    }

    // Non-last (replay) bid: must be accepted to advance the auction.
    // accepted=false means the bid was graded wrong and the auction didn't advance.
    if (!result.accepted) {
      console.error(`Replay failed: bid "${userBids[i]}" was not accepted at step ${i + 1} (graded ${result.grade}). Auction did not advance.`);
      process.exit(2);
    }

    // If auction completed mid-replay, error out
    if (result.phaseTransition) {
      console.error(`Auction completed after bid "${userBids[i]}" at step ${i + 1}, but ${userBids.length - i - 1} bids remain`);
      process.exit(2);
    }
  }
}
