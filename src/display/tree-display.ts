import type {
  RuleNode,
  HandNode,
  DecisionMetadata,
  BidMetadata,
  ConventionExplanations,
} from "../conventions/core/rule-tree";
import type { BiddingContext } from "../conventions/core/types";
import type { Call } from "../engine/types";
import { STRAIN_SYMBOLS } from "./format";
import { BidSuit } from "../engine/types";

/** Context for overlay-aware tree display. */
export interface TreeDisplayOverlayContext {
  /** Replacement tree from active overlay (flattened instead of base tree). */
  readonly replacementTree?: HandNode;
  /** Whether the system is off (overlay disabled standard responses). */
  readonly systemOff?: boolean;
  /** Intent node names suppressed by overlay hooks. Display marks these as inactive. */
  readonly suppressedIntents?: ReadonlySet<string>;
  /** Intent node names with overridden calls (resolver override changed the bid). */
  readonly overriddenIntents?: ReadonlySet<string>;
  /** Intent names added by overlay hooks (not in the base tree). */
  readonly addedIntents?: readonly { readonly name: string; readonly meaning: string }[];
}

export interface TreeDisplayRow {
  readonly id: string;
  readonly depth: number;
  readonly type: "decision" | "bid" | "fallback";
  readonly name: string;
  readonly conditionLabel: string | null;
  readonly conditionCategory: "auction" | "hand" | null;
  /** Original raw label before incremental/formatting transforms (for tooltips). */
  readonly fullConditionLabel?: string | null;
  readonly meaning: string | null;
  readonly callResolver: ((ctx: BiddingContext) => Call) | null;
  readonly hasChildren: boolean;
  readonly parentId: string | null;
  readonly branch: "yes" | "no" | null;
  /** Teaching explanation from condition registry (null if not available). */
  readonly teachingExplanation: string | null;
  /** Decision node teaching metadata from explanations (null for non-decision rows). */
  readonly decisionMetadata: DecisionMetadata | null;
  /** Bid node teaching metadata from explanations (null for non-bid rows). */
  readonly bidMetadata: BidMetadata | null;
  /** Denial implication from parent decision node (only on NO-branch rows). */
  readonly denialImplication: string | null;
  /** Whether the convention system is off for this display context. */
  readonly systemOff?: boolean;
  /** Whether this intent was suppressed by an overlay hook. */
  readonly suppressedByOverlay?: boolean;
  /** Whether this intent's call was overridden by an overlay resolver. */
  readonly overriddenByOverlay?: boolean;
}

interface StackEntry {
  node: RuleNode;
  depth: number;
  parentId: string | null;
  branch: "yes" | "no" | null;
  // Nearest ancestor's parsed auction alternatives (for incremental label stripping).
  // Each alternative is an array of raw bid tokens (e.g. ["1NT", "P", "2C", "P"]).
  nearestAncestorAuctionAlts: string[][];
  // Denial implication inherited from parent decision (only for NO-branch children).
  denialImplication: string | null;
}

// ─── Bid token formatting ────────────────────────────────────

/** Map single-letter strain codes to display symbols, derived from STRAIN_SYMBOLS. */
const SUIT_TOKEN_MAP: Record<string, string> = {
  C: STRAIN_SYMBOLS[BidSuit.Clubs],
  D: STRAIN_SYMBOLS[BidSuit.Diamonds],
  H: STRAIN_SYMBOLS[BidSuit.Hearts],
  S: STRAIN_SYMBOLS[BidSuit.Spades],
};

/** Format a single bid token with suit symbols.
 *  "1C" → "1♣", "2H" → "2♥", "1NT" → "1NT", "P" → "Pass", "X" → "Dbl", "XX" → "Rdbl"
 *  Canonical display formatter for bid tokens — use this instead of duplicating mappings. */
export function formatBidToken(token: string): string {
  if (token === "P") return "Pass";
  if (token === "X") return "Dbl";
  if (token === "XX") return "Rdbl";

  // Level + strain: "1C", "2H", "3NT", etc.
  const match = token.match(/^(\d)(C|D|H|S|NT)$/);
  if (match) {
    const level = match[1]!;
    const strain = match[2]!;
    const symbol = SUIT_TOKEN_MAP[strain];
    return symbol ? `${level}${symbol}` : `${level}${strain}`;
  }
  return token;
}

// ─── Internal auction label parsing ──────────────────────────

/** Separator used by auctionMatches() in auction-conditions.ts */
const EM_DASH_SEP = " \u2014 ";

/** Parse "After X — Y — Z" or "After X — Y or A — B" into arrays of bid-token alternatives.
 *  Returns null if label doesn't match the "After ..." pattern. */
function parseAuctionLabel(label: string): string[][] | null {
  if (!label.startsWith("After ")) return null;
  const body = label.slice("After ".length);

  // Split on " or " for auctionMatchesAny alternatives
  const altStrings = body.split(" or ");
  const alts: string[][] = [];
  for (const alt of altStrings) {
    const tokens = alt.split(EM_DASH_SEP);
    if (tokens.length === 0 || (tokens.length === 1 && tokens[0] === "")) {
      return null;
    }
    alts.push(tokens);
  }
  return alts.length > 0 ? alts : null;
}

/** Format an array of bid tokens, joined with " — ". */
function formatTokens(tokens: string[]): string {
  return tokens.map(formatBidToken).join(` ${"\u2014"} `);
}

/** Check if `prefix` tokens are a prefix of `tokens`. */
function isTokenPrefix(prefix: string[], tokens: string[]): boolean {
  if (prefix.length > tokens.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (prefix[i] !== tokens[i]) return false;
  }
  return true;
}

/** Compute incremental formatted label by stripping ancestor prefix from each alternative.
 *  Given "After 1NT — P — 2C — P" with ancestor "After 1NT — P", produces "Then 2♣ — Pass".
 *  Deduplicates identical suffixes. Falls back to full formatted label if no prefix match. */
function computeIncrementalLabel(
  parsedAlternatives: string[][],
  ancestorAlts: string[][],
): string {
  if (ancestorAlts.length === 0) {
    const formatted = parsedAlternatives.map(formatTokens);
    return `After ${[...new Set(formatted)].join(" or ")}`;
  }

  const suffixes: string[] = [];
  let allPrefixesMatched = true;

  for (const childAlt of parsedAlternatives) {
    let bestSuffix: string[] | null = null;
    let bestPrefixLen = 0;

    for (const ancAlt of ancestorAlts) {
      if (isTokenPrefix(ancAlt, childAlt) && ancAlt.length > bestPrefixLen) {
        bestPrefixLen = ancAlt.length;
        bestSuffix = childAlt.slice(ancAlt.length);
      }
    }

    if (bestSuffix && bestSuffix.length > 0) {
      suffixes.push(formatTokens(bestSuffix));
    } else {
      allPrefixesMatched = false;
      suffixes.push(formatTokens(childAlt));
    }
  }

  const unique = [...new Set(suffixes)];
  return allPrefixesMatched
    ? `Then ${unique.join(" or ")}`
    : `After ${unique.join(" or ")}`;
}

// ─── Tree flattening ─────────────────────────────────────────

/** Walk a RuleNode tree depth-first, producing a flat display row list.
 *  FallbackNodes without a reason are skipped (they represent structural dead-ends).
 *  FallbackNodes WITH a reason are included as rows (type: "fallback", name = reason).
 *  Auction condition labels are transformed: formatted with suit symbols and made
 *  incremental relative to the nearest ancestor auction node. */
export function flattenTreeForDisplay(
  tree: RuleNode,
  explanations?: ConventionExplanations,
  overlayContext?: TreeDisplayOverlayContext,
): TreeDisplayRow[] {
  const effectiveTree = overlayContext?.replacementTree ?? tree;
  const systemOff = overlayContext?.systemOff;
  const rows = flattenBinaryTreeForDisplay(effectiveTree, explanations, systemOff);

  // Mark suppressed/overridden intents from overlay context
  if (overlayContext?.suppressedIntents || overlayContext?.overriddenIntents) {
    const suppressed = overlayContext.suppressedIntents;
    const overridden = overlayContext.overriddenIntents;
    return rows.map(row => {
      if (row.type !== "bid") return row;
      return {
        ...row,
        suppressedByOverlay: suppressed?.has(row.name) || undefined,
        overriddenByOverlay: overridden?.has(row.name) || undefined,
      };
    });
  }

  // Append added intents from overlay as additional bid rows
  if (overlayContext?.addedIntents && overlayContext.addedIntents.length > 0) {
    const maxDepth = rows.reduce((max, r) => Math.max(max, r.depth), 0);
    for (const added of overlayContext.addedIntents) {
      rows.push({
        id: `row-${rows.length}`,
        depth: maxDepth,
        type: "bid",
        name: added.name,
        conditionLabel: null,
        conditionCategory: null,
        fullConditionLabel: null,
        meaning: added.meaning,
        callResolver: null,
        hasChildren: false,
        parentId: null,
        branch: null,
        teachingExplanation: null,
        decisionMetadata: null,
        bidMetadata: null,
        denialImplication: null,
        systemOff,
      });
    }
  }

  return rows;
}

function flattenBinaryTreeForDisplay(
  tree: RuleNode,
  explanations?: ConventionExplanations,
  systemOff?: boolean,
): TreeDisplayRow[] {
  const rows: TreeDisplayRow[] = [];
  const stack: StackEntry[] = [
    {
      node: tree,
      depth: 0,
      parentId: null,
      branch: null,
      nearestAncestorAuctionAlts: [],
      denialImplication: null,
    },
  ];

  while (stack.length > 0) {
    const { node, depth, parentId, branch, nearestAncestorAuctionAlts, denialImplication } =
      stack.pop()!;
    const id = `row-${rows.length}`;

    switch (node.type) {
      case "decision": {
        const rawLabel = node.condition.label;
        let conditionLabel = rawLabel;
        let fullConditionLabel = rawLabel;
        let childAncestorAlts = nearestAncestorAuctionAlts;

        if (node.condition.category === "auction") {
          const parsed = parseAuctionLabel(rawLabel);
          if (parsed) {
            conditionLabel = computeIncrementalLabel(
              parsed,
              nearestAncestorAuctionAlts,
            );
            // Propagate this node's parsed tokens as ancestor for children
            childAncestorAlts = parsed;
          }
          // Non-"After ..." auction conditions (e.g. "Opening bidder") pass through unchanged
        }

        const decisionTeaching =
          explanations?.conditions?.[node.condition.name] ??
          node.condition.teachingNote ??
          null;

        const resolvedMetadata =
          explanations?.decisions?.[node.name] ??
          node.metadata ??
          null;

        // Resolve denial implication for NO-branch children
        const childDenialImplication =
          resolvedMetadata?.denialImplication ?? null;

        rows.push({
          id,
          depth,
          type: "decision",
          name: node.name,
          conditionLabel,
          conditionCategory: node.condition.category,
          fullConditionLabel,
          meaning: null,
          callResolver: null,
          hasChildren: true,
          parentId,
          branch,
          teachingExplanation: decisionTeaching,
          decisionMetadata: resolvedMetadata,
          bidMetadata: null,
          denialImplication,
          systemOff,
        });
        // NO branch first (pushed first = popped last in DFS), then YES
        // Auction chains: flatten NO-branch auction siblings to same depth
        if (
          node.condition.category === "auction" &&
          node.no.type === "decision" &&
          node.no.condition.category === "auction"
        ) {
          // Sibling auction context: same depth, same parent, inherit ancestor alts (not this node's)
          stack.push({
            node: node.no,
            depth,
            parentId,
            branch: null,
            nearestAncestorAuctionAlts,
            denialImplication: null,
          });
        } else if (
          node.condition.category === "auction" &&
          node.no.type === "fallback"
        ) {
          // Terminal fallback at end of auction chain — skip
        } else {
          stack.push({
            node: node.no,
            depth: depth + 1,
            parentId: id,
            branch: "no",
            nearestAncestorAuctionAlts: childAncestorAlts,
            denialImplication: childDenialImplication,
          });
        }
        // YES branch pushed last = popped first (DFS pre-order)
        stack.push({
          node: node.yes,
          depth: depth + 1,
          parentId: id,
          branch: "yes",
          nearestAncestorAuctionAlts: childAncestorAlts,
          denialImplication: null,
        });
        break;
      }

      case "intent":
        rows.push({
          id,
          depth,
          type: "bid",
          name: node.name,
          conditionLabel: null,
          conditionCategory: null,
          fullConditionLabel: null,
          meaning: node.meaning,
          callResolver: node.defaultCall,
          hasChildren: false,
          parentId,
          branch,
          teachingExplanation: null,
          decisionMetadata: null,
          bidMetadata:
            explanations?.bids?.[node.name] ?? node.metadata ?? null,
          denialImplication,
          systemOff,
        });
        break;

      case "fallback":
        if (node.reason) {
          rows.push({
            id,
            depth,
            type: "fallback",
            name: node.reason,
            conditionLabel: null,
            conditionCategory: null,
            fullConditionLabel: null,
            meaning: null,
            callResolver: null,
            hasChildren: false,
            parentId,
            branch,
            teachingExplanation: null,
            decisionMetadata: null,
            bidMetadata: null,
            denialImplication,
            systemOff,
          });
        }
        break;
    }
  }

  return rows;
}
