import type {
  RuleCondition,
  AuctionCondition,
  HandCondition,
  BiddingContext,
  ConventionConfig,
  ConventionTeaching,
} from "./types";
import type { Call } from "../../engine/types";

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

/** Alert information for conventional (non-natural) bids. */
export interface BidAlert {
  readonly artificial: boolean;
  readonly forcingType: "forcing" | "game-forcing" | "invitational" | "signoff" | null;
}

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
  /** Teaching content for bid nodes, keyed by BidNode.name. */
  readonly bids?: Readonly<Record<string, BidMetadata>>;
  /** Teaching content for conditions, keyed by RuleCondition name.
   *  Convention-specific explanations of shared conditions
   *  (e.g., "8+ HCP" means something different in Stayman vs Bergen). */
  readonly conditions?: Readonly<Record<string, string>>;
}

// ─── Auction slot types (multi-way dispatch) ─────────────────

/** Role of the active bidder at an auction slot. */
export enum ActiveRole {
  Opener = "opener",
  Responder = "responder",
  Overcaller = "overcaller",
  Advancer = "advancer",
}

/** Teaching metadata for slot dispatch nodes. */
export interface SlotMetadata {
  readonly description?: string;
  readonly roundLabel?: string;
}

/** One branch of a multi-way auction dispatch. */
export interface AuctionSlot {
  readonly name: string;
  readonly condition: AuctionCondition;
  readonly child: AuctionSlotNode | HandNode;
  readonly label?: string;
  readonly role?: ActiveRole;
  readonly metadata?: SlotMetadata;
}

/** Multi-way auction dispatch node. Slots evaluated in order; first match wins. */
export interface AuctionSlotNode {
  readonly type: "auction-slots";
  readonly name: string;
  readonly slots: readonly AuctionSlot[];
  /** If no slot matches. Defaults to "convention doesn't apply." */
  readonly defaultChild?: HandNode | FallbackNode;
  readonly metadata?: SlotMetadata;
}

/** Root of a convention tree — either slot-based or legacy binary. */
export type ConventionTreeRoot = AuctionSlotNode | RuleNode;

// ─── Tree node types ─────────────────────────────────────────

export interface DecisionNode {
  readonly type: "decision";
  readonly name: string;
  readonly condition: RuleCondition;
  readonly yes: RuleNode;
  readonly no: RuleNode;
  readonly metadata?: DecisionMetadata;
}

export interface BidNode {
  readonly type: "bid";
  readonly name: string;
  /** What this bid communicates to partner. Self-contained sentence fragment starting
   *  with an action verb (e.g., "Asks for a 4-card major"). No HCP numbers, no convention
   *  name, no auction context — those are derivable from the tree path and config. */
  readonly meaning: string;
  readonly call: (ctx: BiddingContext) => Call;
  readonly metadata?: BidMetadata;
  readonly alert?: BidAlert;
}

export interface FallbackNode {
  readonly type: "fallback";
  readonly reason?: string;
}

export type RuleNode = DecisionNode | BidNode | FallbackNode;

// ─── Typed decision node subtypes ───────────────────────────

/** A node that can only appear in hand-condition subtrees. */
export type HandNode = HandDecisionNode | BidNode | FallbackNode;

/** A decision node that checks hand properties. Children can only be hand nodes. */
export interface HandDecisionNode extends DecisionNode {
  readonly condition: HandCondition;
  readonly yes: HandNode;
  readonly no: HandNode;
}

// ─── Tree convention config ──────────────────────────────────

/**
 * Convention config using a hierarchical rule tree instead of flat rules.
 * `biddingRules` must be set to `flattenTree(ruleTree)` — NOT `[]`.
 * Registry dispatch evaluates `ruleTree` directly, but other consumers
 * (CLI, RulesPanel, inference engine) iterate `biddingRules`.
 */
export interface TreeConventionConfig extends ConventionConfig {
  readonly ruleTree: ConventionTreeRoot;
  readonly explanations?: ConventionExplanations;
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

export function bid(
  name: string,
  meaning: string,
  callFn: (ctx: BiddingContext) => Call,
  metadata?: BidMetadata,
): BidNode {
  return { type: "bid", name, meaning, call: callFn, metadata };
}

export function fallback(reason?: string): FallbackNode {
  return { type: "fallback", reason };
}

// ─── Slot tree builders ──────────────────────────────────────

export function auctionSlots(
  name: string,
  slots: readonly AuctionSlot[],
  defaultChild?: HandNode | FallbackNode,
  metadata?: SlotMetadata,
): AuctionSlotNode {
  return { type: "auction-slots", name, slots, defaultChild, metadata };
}

export function slot(
  name: string,
  condition: AuctionCondition,
  child: AuctionSlotNode | HandNode,
  options?: { label?: string; role?: ActiveRole; metadata?: SlotMetadata },
): AuctionSlot {
  return {
    name,
    condition,
    child,
    label: options?.label,
    role: options?.role,
    metadata: options?.metadata,
  };
}

// ─── Slot tree validation ────────────────────────────────────

/**
 * Validate that all slot conditions are auction conditions.
 * Recursively checks nested AuctionSlotNode children.
 * Throws if a non-auction condition is found in any slot.
 */
export function validateSlotTree(tree: AuctionSlotNode): void {
  for (const s of tree.slots) {
    if (s.condition.category !== "auction") {
      throw new Error(
        `Slot tree validation: slot "${s.name}" in "${tree.name}" has ` +
          `condition "${s.condition.name}" with category "${s.condition.category}" — ` +
          `expected "auction".`,
      );
    }
    if (s.child.type === "auction-slots") {
      validateSlotTree(s.child);
    }
  }
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
