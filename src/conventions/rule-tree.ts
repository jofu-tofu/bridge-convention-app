import type {
  RuleCondition,
  BiddingContext,
  ConventionConfig,
} from "./types";
import type { Call } from "../engine/types";

// ─── Node metadata ───────────────────────────────────────────

export interface NodeMetadata {
  readonly description?: string;
  readonly pedagogicalNote?: string;
}

// ─── Tree node types ─────────────────────────────────────────

export interface DecisionNode {
  readonly type: "decision";
  readonly name: string;
  readonly condition: RuleCondition;
  readonly yes: RuleNode;
  readonly no: RuleNode;
  readonly metadata?: NodeMetadata;
}

export interface BidNode {
  readonly type: "bid";
  readonly name: string;
  readonly call: (ctx: BiddingContext) => Call;
  readonly metadata?: NodeMetadata;
}

export interface FallbackNode {
  readonly type: "fallback";
  readonly reason?: string;
}

export type RuleNode = DecisionNode | BidNode | FallbackNode;

// ─── Tree convention config ──────────────────────────────────

/**
 * Convention config using a hierarchical rule tree instead of flat rules.
 * `biddingRules` must be set to `flattenTree(ruleTree)` — NOT `[]`.
 * Registry dispatch evaluates `ruleTree` directly, but other consumers
 * (CLI, RulesPanel, inference engine) iterate `biddingRules`.
 */
export interface TreeConventionConfig extends ConventionConfig {
  readonly ruleTree: RuleNode;
}

// ─── Builder helpers (thin constructors) ─────────────────────

export function decision(
  name: string,
  condition: RuleCondition,
  yes: RuleNode,
  no: RuleNode,
  metadata?: NodeMetadata,
): DecisionNode {
  return { type: "decision", name, condition, yes, no, metadata };
}

export function bid(
  name: string,
  callFn: (ctx: BiddingContext) => Call,
  metadata?: NodeMetadata,
): BidNode {
  return { type: "bid", name, call: callFn, metadata };
}

export function fallback(reason?: string): FallbackNode {
  return { type: "fallback", reason };
}
