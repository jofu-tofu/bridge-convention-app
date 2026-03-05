import type {
  RuleCondition,
  HandCondition,
  ConventionTeaching,
  ConventionConfig,
} from "./types";
import type { IntentNode } from "./intent/intent-node";

// Re-export IntentNode for consumers that import from rule-tree
export type { IntentNode } from "./intent/intent-node";

/**
 * Backward-compatible alias for callers that still import this type from rule-tree.
 * Protocol conventions are the supported convention shape.
 */
export type TreeConventionConfig = ConventionConfig;

// ─── Teaching metadata for decision nodes ───────────────────

/** Teaching metadata for decision nodes (branching questions about hand/auction). */
export interface DecisionMetadata {
  /** Why this question matters — what it determines about the hand or auction. */
  readonly whyThisMatters?: string;
  /** Common mistake or misconception at this decision point. */
  readonly commonMistake?: string;
  /** What taking the NO branch reveals to partner. */
  readonly denialImplication?: string;
}

// ─── Alert metadata for bid nodes ───────────────────────────

// Re-export from canonical location in shared/types for backward compatibility
export type { BidAlert } from "../../shared/types";

// ─── Teaching metadata for bid nodes ────────────────────────

/** Teaching metadata for bid nodes (terminal actions). */
export interface BidMetadata {
  /** Why this bid instead of alternatives — the reasoning, not just what it communicates. */
  readonly whyThisBid?: string;
  /** What partner should do after this bid. */
  readonly partnerExpects?: string;
  /** Whether this bid is artificial (conventional, not showing the named suit). */
  readonly isArtificial?: boolean;
  /** Forcing nature of this bid. */
  readonly forcingType?: "forcing" | "game-forcing" | "invitational" | "signoff";
  /** Common mistake or misconception when making this bid. */
  readonly commonMistake?: string;
}

// ─── Per-convention teaching content ────────────────────────

/** Per-convention teaching content, keyed by node name. */
export interface ConventionExplanations {
  /** Convention-level teaching metadata. */
  readonly convention?: ConventionTeaching;
  /** Teaching content for decision nodes, keyed by DecisionNode.name. */
  readonly decisions?: Readonly<Record<string, DecisionMetadata>>;
  /** Teaching content for bid nodes, keyed by IntentNode.name. */
  readonly bids?: Readonly<Record<string, BidMetadata>>;
  /** Teaching content for conditions, keyed by RuleCondition name.
   *  Convention-specific explanations of shared conditions
   *  (e.g., "8+ HCP" means something different in Stayman vs Bergen). */
  readonly conditions?: Readonly<Record<string, string>>;
}

// ─── Tree node types ─────────────────────────────────────────

export interface DecisionNode {
  readonly type: "decision";
  readonly name: string;
  readonly condition: RuleCondition;
  readonly yes: RuleNode;
  readonly no: RuleNode;
  readonly metadata?: DecisionMetadata;
}

export interface FallbackNode {
  readonly type: "fallback";
  readonly reason?: string;
}

export type RuleNode = DecisionNode | IntentNode | FallbackNode;

// ─── Typed decision node subtypes ───────────────────────────

/** A node that can only appear in hand-condition subtrees. */
export type HandNode = HandDecisionNode | IntentNode | FallbackNode;

/** A decision node that checks hand properties. Children can only be hand nodes. */
export interface HandDecisionNode extends DecisionNode {
  readonly condition: HandCondition;
  readonly yes: HandNode;
  readonly no: HandNode;
}

// ─── Builder helpers (thin constructors) ─────────────────────

export function decision(
  name: string,
  condition: RuleCondition,
  yes: RuleNode,
  no: RuleNode,
  metadata?: DecisionMetadata,
): DecisionNode {
  return { type: "decision", name, condition, yes, no, metadata };
}

/** Build a decision node that checks a hand condition. */
export function handDecision(
  name: string,
  condition: HandCondition,
  yes: HandNode,
  no: HandNode,
  metadata?: DecisionMetadata,
): HandDecisionNode {
  return { type: "decision", name, condition, yes, no, metadata };
}

export function fallback(reason?: string): FallbackNode {
  return { type: "fallback", reason };
}

// ─── Tree validation ─────────────────────────────────────────

/**
 * Validate that auction conditions always precede hand conditions on every path.
 * Throws if an auction condition appears after a hand condition on any tree path.
 */
export function validateTree(tree: RuleNode): void {
  function walk(node: RuleNode, seenHand: boolean): void {
    if (node.type !== "decision") return;
    const isAuction = node.condition.category === "auction";
    if (isAuction && seenHand) {
      throw new Error(
        `Tree validation: auction condition "${node.condition.name}" (node "${node.name}") ` +
          `appears after a hand condition. Auction conditions must precede hand conditions.`,
      );
    }
    const nextSeenHand = seenHand || !isAuction;
    walk(node.yes, nextSeenHand);
    walk(node.no, nextSeenHand);
  }
  walk(tree, false);
}
