// ─── Fact layer stratification ──────────────────────────────
//
// Facts are organized into four layers with strict ownership boundaries.
// Each layer has a single owner and a clear scope:
//
//   PRIMITIVE         Hand-intrinsic properties computed by the bridge engine.
//     Owner:          Engine (hand-evaluator, deal types)
//     Varies by:      Nothing — every hand has these
//     Namespace:      hand.*
//     Examples:       hand.hcp, hand.suitLength.spades, hand.isBalanced
//
//   BRIDGE_DERIVED    Bridge-universal facts derived from primitives.
//     Owner:          Shared fact catalog (shared-fact-catalog.ts)
//     Varies by:      Nothing — same in every bidding system
//     Namespace:      bridge.*
//     Examples:       bridge.hasFourCardMajor, bridge.totalPointsForRaise
//
//   SYSTEM_DERIVED    System-semantic facts whose evaluators are parameterized
//                     by SystemConfig (captured via closure).
//     Owner:          System fact catalog (system-fact-catalog.ts)
//     Varies by:      Base system (SAYC vs 2/1 vs Acol)
//     Namespace:      system.*
//     Two flavors:
//       Hand-dependent — combine hand.hcp with system thresholds.
//         derivesFrom: ["hand.hcp"], constrains: ["pointRange"]
//         e.g., system.responder.inviteValues, system.responder.oneNtRange
//       System-constant — pure system properties, same for every hand.
//         derivesFrom: [], constrains: []
//         e.g., system.suitResponse.isGameForcing, system.oneNtResponseAfterMajor.forcing
//         These exist in the catalog so surfaces can gate on them in clause
//         arrays without imperative branching in module code.
//
//   MODULE_DERIVED    Convention-specific facts owned by individual modules.
//     Owner:          Convention module (e.g., bergen/facts.ts)
//     Varies by:      Which conventions are active
//     Namespace:      module.<moduleId>.*
//     Examples:       module.bergen.hasMajorSupport, module.weakTwo.isMinimum
//
// Convention modules reference facts from ANY layer in their surface clauses,
// but they must NEVER define facts outside their own module.* namespace.
// System facts are the mechanism for conventions to adapt to different systems
// without hardcoding thresholds.

/** Stratification of fact definitions — four layers with strict ownership. */
export enum FactLayer {
  /** Hand-intrinsic properties (hand.*). Owner: bridge engine. */
  Primitive = "primitive",
  /** Bridge-universal derived facts (bridge.*). Owner: shared catalog. */
  BridgeDerived = "bridge-derived",
  /** System-semantic facts (system.*). Owner: system catalog, parameterized by SystemConfig. */
  SystemDerived = "system-derived",
  /** Convention-specific facts (module.*). Owner: individual convention modules. */
  ModuleDerived = "module-derived",
}
