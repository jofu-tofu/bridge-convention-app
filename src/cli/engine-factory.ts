import "../conventions";
import type { DealConstraints, DealGeneratorResult } from "../engine/types";
import type { CliDependencies, CliEngine } from "./types";
import { TsEngine } from "../engine/ts-engine";
import { generateDeal } from "../engine/deal-generator";
import { readStdin } from "./stdin";

export function createCliEngine(): CliEngine {
  const tsEngine = new TsEngine();

  return {
    // Delegate all EnginePort methods to TsEngine
    generateDeal: (constraints) => tsEngine.generateDeal(constraints),
    evaluateHand: (hand, strategy) => tsEngine.evaluateHand(hand, strategy),
    getSuitLength: (hand) => tsEngine.getSuitLength(hand),
    isBalanced: (hand) => tsEngine.isBalanced(hand),
    getLegalCalls: (auction, seat) => tsEngine.getLegalCalls(auction, seat),
    addCall: (auction, entry) => tsEngine.addCall(auction, entry),
    isAuctionComplete: (auction) => tsEngine.isAuctionComplete(auction),
    getContract: (auction) => tsEngine.getContract(auction),
    calculateScore: (contract, tricksWon, vulnerable) =>
      tsEngine.calculateScore(contract, tricksWon, vulnerable),
    solveDeal: (deal) => tsEngine.solveDeal(deal),
    suggestPlay: (hand, currentTrick, trumpSuit, previousTricks) =>
      tsEngine.suggestPlay(hand, currentTrick, trumpSuit, previousTricks),
    suggestBid: (hand, auction, seat, strategy) =>
      tsEngine.suggestBid(hand, auction, seat, strategy),
    getLegalPlays: (hand, leadSuit) => tsEngine.getLegalPlays(hand, leadSuit),
    getTrickWinner: (trick) => tsEngine.getTrickWinner(trick),

    // Diagnostics bypass — calls generateDeal directly for full result
    async generateDealWithDiagnostics(
      constraints: DealConstraints,
    ): Promise<DealGeneratorResult> {
      return generateDeal(constraints);
    },
  };
}

export function createCliDependencies(): CliDependencies {
  return {
    engine: createCliEngine(),
    output: console.log,
    errorOutput: console.error,
    readStdin,
  };
}
