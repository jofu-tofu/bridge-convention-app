// ── CLI play command ────────────────────────────────────────────────
//
// Session-based playthrough. Uses the same session API as the UI:
// createDrillSession → startDrill → submitBid loop. Stateless: each
// invocation creates a fresh session (same seed = same deal).

import type { DevServicePort, BiddingViewport, SessionConfig } from "../../service";
import { ViewportBidGrade, PlayPreference, getSystemConfig, DEFAULT_BASE_MODULE_IDS } from "../../service";
import type { Flags } from "../shared";
import {
  requireArg, optionalNumericArg, parseCallString,
  parseVulnerability, parseOpponentMode, parseBaseSystem,
  parsePracticeMode, parsePracticeRole,
  printJson,
} from "../shared";

type ViewportSummarySource = Pick<
  BiddingViewport,
  "seat" | "hand" | "handEvaluation" | "handSummary" | "auctionEntries" | "legalCalls" | "conventionName" | "isUserTurn" | "bidContext"
>;

function summarizeViewport(viewport: ViewportSummarySource) {
  return {
    seat: viewport.seat,
    hand: viewport.hand,
    hcp: viewport.handEvaluation?.hcp ?? null,
    handSummary: viewport.handSummary,
    auction: viewport.auctionEntries,
    legalCalls: viewport.legalCalls,
    conventionName: viewport.conventionName,
    isUserTurn: viewport.isUserTurn,
    bidContext: viewport.bidContext,
  };
}

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
    systemConfig: getSystemConfig(system),
    baseModuleIds: [...DEFAULT_BASE_MODULE_IDS],
    vulnerability: vuln,
    opponentMode: opponents,
    practiceMode: mode,
    ...(moduleId ? { target: { kind: "module" as const, moduleId } } : {}),
    practiceRole: role,
    playPreference: PlayPreference.Skip, // always skip to review after bidding
  };

  // Create session + start drill
  const handle = await service.createDrillSession(config);
  const drillResult = await service.startDrill(handle);

  // No bids requested — return the initial viewport
  if (userBids.length === 0) {
    const vp = drillResult.viewport;
    printJson({
      ...summarizeViewport(vp),
      auctionComplete: drillResult.auctionComplete,
    });
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

      printJson(output);

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
