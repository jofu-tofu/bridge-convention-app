/**
 * Re-export evaluateHand for component use.
 * Components import from lib/ (not engine/) per EnginePort boundary rule.
 */
export { evaluateHand } from "../engine/hand-evaluator";
