// Protocol subsystem barrel — auction protocol system.

export { protocol, round, semantic, validateProtocol } from "./protocol";
export type {
  AuctionRole,
  ConventionProtocol,
  ProtocolRound,
  SemanticTrigger,
  EstablishedContext,
  MatchedRoundEntry,
  ProtocolEvalResult,
} from "./protocol";

export { evaluateProtocol, computeRole } from "./protocol-evaluator";
