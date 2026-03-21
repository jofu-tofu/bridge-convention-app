/**
 * Bundle Registry — central definitions for all convention bundles.
 *
 * Each bundle definition composes modules (via ruleModules) with deal constraints,
 * system profile, and teaching metadata. `buildBundle()` aggregates pedagogical
 * content from the module registry and collects surfaces/facts from rule modules.
 */

import type { ConventionBundle } from "../core/bundle/bundle-types";
import type { ConventionSpec } from "../core/protocol/types";
import type { RuleModule } from "../core/rule-module";
import type { BidMeaning } from "../../core/contracts/meaning";
import type { SystemProfile } from "../../core/contracts/agreement-module";
import type { ConventionTeaching } from "../../core/contracts/convention";
import type { ExplanationCatalog } from "../../core/contracts/explanation-catalog";
import type { TeachingRelation } from "../../core/contracts/teaching-projection";
import type { AlternativeGroup, IntentFamily } from "../../core/contracts/tree-evaluation";
import type { DealConstraints, Deal, Seat as SeatType, Auction } from "../../engine/types";
import { createExplanationCatalog } from "../../core/contracts/explanation-catalog";
import { getModules } from "./module-registry";
import { deriveTeachingContent } from "./derive-cross-module";

import { Seat, Suit } from "../../engine/types";
import { ConventionCategory } from "../../core/contracts/convention";
import { CAP_OPENING_1NT, CAP_OPENING_MAJOR, CAP_OPPONENT_1NT } from "./capability-vocabulary";
import { buildAuction } from "../../engine/auction-helpers";
import { NT_SAYC_PROFILE, NT_STAYMAN_ONLY_PROFILE, NT_TRANSFERS_ONLY_PROFILE } from "./nt-bundle/system-profile";
import { naturalNtRules } from "./modules/natural-nt-rules";
import { staymanRules } from "./modules/stayman-rules";
import { jacobyTransfersRules } from "./modules/jacoby-transfers-rules";
import { smolenRules } from "./modules/smolen-rules";
import { BERGEN_PROFILE } from "./bergen-bundle/system-profile";
import { bergenRules } from "./modules/bergen/bergen-rules";
import { DONT_PROFILE } from "./dont-bundle/system-profile";
import { dontRules } from "./modules/dont/dont-rules";
import { WEAK_TWO_PROFILE } from "./weak-twos-bundle/system-profile";
import { weakTwosRules } from "./modules/weak-twos/weak-twos-rules";

// ── Bundle definition type (internal) ──────────────────────────────

interface BundleDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ConventionCategory;
  readonly internal?: boolean;
  readonly memberIds: readonly string[];
  readonly systemProfile: SystemProfile;
  readonly ruleModules: readonly RuleModule[];
  readonly dealConstraints: DealConstraints;
  readonly offConventionConstraints?: DealConstraints;
  readonly defaultAuction?: (seat: SeatType, deal?: Deal) => Auction | undefined;
  readonly declaredCapabilities?: Readonly<Record<string, string>>;
  readonly teaching?: ConventionTeaching;
  readonly allowedDealers?: readonly SeatType[];
}

// ── Module aggregation ──────────────────────────────────────────────

/** Aggregate teaching/grading content from module IDs. */
function aggregateModuleContent(moduleIds: readonly string[]): {
  explanationCatalog: ExplanationCatalog;
  teachingRelations: readonly TeachingRelation[];
  acceptableAlternatives: readonly AlternativeGroup[];
  intentFamilies: readonly IntentFamily[];
} {
  const modules = getModules(moduleIds);
  const derived = deriveTeachingContent(modules);
  return {
    explanationCatalog: createExplanationCatalog(
      modules.flatMap((m) => m.explanationEntries),
    ),
    teachingRelations: derived.relations,
    acceptableAlternatives: derived.alternatives,
    intentFamilies: derived.intentFamilies,
  };
}

// ── Bundle factory ──────────────────────────────────────────────────

/**
 * Build a ConventionBundle from a flat definition object.
 * Aggregates pedagogical content from modules and collects surfaces/facts
 * from rule modules.
 */
function buildBundle(def: BundleDefinition): ConventionBundle {
  const { explanationCatalog, teachingRelations, acceptableAlternatives, intentFamilies } =
    aggregateModuleContent(def.memberIds);

  return {
    id: def.id,
    name: def.name,
    description: def.description,
    category: def.category,
    internal: def.internal,
    memberIds: def.memberIds,
    dealConstraints: def.dealConstraints,
    offConventionConstraints: def.offConventionConstraints,
    defaultAuction: def.defaultAuction,
    declaredCapabilities: def.declaredCapabilities,
    systemProfile: def.systemProfile,
    teaching: def.teaching,
    allowedDealers: def.allowedDealers,
    ruleModules: def.ruleModules,
    explanationCatalog,
    teachingRelations,
    acceptableAlternatives,
    intentFamilies,
    ...collectRuleModuleContent(def.ruleModules),
  };
}

/**
 * Collect surfaces, facts, and explanations directly from RuleModule[].
 * No FSM or skeleton needed — rules are the sole source of convention logic.
 */
function collectRuleModuleContent(
  ruleModules: readonly RuleModule[],
): Pick<ConventionBundle, "meaningSurfaces" | "factExtensions"> {
  const surfaceGroups: { groupId: string; surfaces: BidMeaning[] }[] = [];
  const seenMeaningIds = new Set<string>();

  for (const mod of ruleModules) {
    const moduleSurfaces: BidMeaning[] = [];
    for (const rule of mod.rules) {
      for (const claim of rule.claims) {
        if (!seenMeaningIds.has(claim.surface.meaningId)) {
          seenMeaningIds.add(claim.surface.meaningId);
          moduleSurfaces.push(claim.surface);
        }
      }
    }
    if (moduleSurfaces.length > 0) {
      surfaceGroups.push({ groupId: mod.id, surfaces: moduleSurfaces });
    }
  }

  const factExtensions = ruleModules
    .map((m) => m.facts)
    .filter((f) => f.definitions.length > 0 || f.evaluators.size > 0);

  return {
    meaningSurfaces: surfaceGroups,
    factExtensions,
  };
}

// ── Bundle definitions ──────────────────────────────────────────────

export const ntBundle = buildBundle({
  id: "nt-bundle",
  name: "1NT Responses",
  description: "Full 1NT response system: Stayman + Jacoby Transfers + Smolen + natural bids — practice choosing between conventions",
  category: ConventionCategory.Constructive,
  systemProfile: NT_SAYC_PROFILE,
  memberIds: ["natural-nt", "stayman", "jacoby-transfers", "smolen"],
  dealConstraints: {
    seats: [
      { seat: Seat.North, minHcp: 15, maxHcp: 17, balanced: true },
      { seat: Seat.South, minHcp: 0 },
    ],
    dealer: Seat.North,
  },
  offConventionConstraints: {
    seats: [
      { seat: Seat.North, minHcp: 15, maxHcp: 17, balanced: true },
      { seat: Seat.South, minHcp: 0, maxHcp: 7 },
    ],
    dealer: Seat.North,
  },
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) return buildAuction(Seat.North, ["1NT", "P"]);
    return undefined;
  },
  declaredCapabilities: { [CAP_OPENING_1NT]: "active" },
  ruleModules: [naturalNtRules, staymanRules, jacobyTransfersRules, smolenRules],
  teaching: {
    purpose:
      "Find the best contract after partner opens 1NT: major-suit fit via Stayman, transfers, or Smolen, or notrump game/invite",
    whenToUse:
      "Partner opens 1NT (15-17 HCP balanced). You choose between Stayman (4-card major, 8+ HCP), Jacoby Transfer (5+ card major), Smolen (5-4 in majors, game values — bid Stayman then show pattern), or natural NT bids (no major).",
    whenNotToUse: [
      "0-7 HCP with no 5-card major — pass",
      "5+ card major with no 4-card in the other major — use transfer, not Stayman",
      "5-4 in majors with only invite values (8-9 HCP) — transfer to the 5-card major",
      "4333 shape with 8-9 HCP — 2NT invite may be better than Stayman",
    ],
    tradeoff:
      "Artificial bids (2♣ Stayman, 2♦/2♥ transfers, Smolen 3H/3S) give up natural meanings of those bids",
    principle:
      "Finding an 8-card major fit is worth more than notrump; Stayman, transfers, and Smolen are tools to find that fit while keeping the strong hand as declarer",
    roles:
      "Responder is captain after 1NT — opener describes, responder decides the final contract",
  },
});

export const ntStaymanBundle = buildBundle({
  id: "nt-stayman",
  name: "Stayman",
  description: "Stayman convention — find a 4-4 major fit after 1NT opening",
  category: ConventionCategory.Asking,
  systemProfile: NT_STAYMAN_ONLY_PROFILE,
  memberIds: ["natural-nt", "stayman"],
  dealConstraints: {
    seats: [
      { seat: Seat.North, minHcp: 15, maxHcp: 17, balanced: true },
      { seat: Seat.South, minHcp: 8, minLengthAny: { [Suit.Spades]: 4, [Suit.Hearts]: 4 } },
    ],
    dealer: Seat.North,
  },
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) return buildAuction(Seat.North, ["1NT", "P"]);
    return undefined;
  },
  declaredCapabilities: { [CAP_OPENING_1NT]: "active" },
  ruleModules: [naturalNtRules, staymanRules],
  teaching: {
    purpose:
      "Find a 4-4 major-suit fit after partner opens 1NT using the 2♣ Stayman bid",
    whenToUse:
      "Partner opens 1NT (15-17 HCP balanced). You have 8+ HCP and a 4-card major (no 5-card major).",
    whenNotToUse: [
      "5+ card major — use Jacoby Transfer instead",
      "Under 8 HCP — pass",
      "No 4-card major — bid 2NT (invite) or 3NT (game) directly",
    ],
    principle:
      "2C asks opener to show a 4-card major; responder then places the contract based on fit",
    roles:
      "Responder is captain — asks opener to describe, then decides the final contract",
  },
});

export const ntTransfersBundle = buildBundle({
  id: "nt-transfers",
  name: "Jacoby Transfers",
  description: "Jacoby Transfers — ensure the strong hand declares in a major-suit contract",
  category: ConventionCategory.Constructive,
  systemProfile: NT_TRANSFERS_ONLY_PROFILE,
  memberIds: ["natural-nt", "jacoby-transfers"],
  dealConstraints: {
    seats: [
      { seat: Seat.North, minHcp: 15, maxHcp: 17, balanced: true },
      { seat: Seat.South, minHcp: 0, minLengthAny: { [Suit.Spades]: 5, [Suit.Hearts]: 5 } },
    ],
    dealer: Seat.North,
  },
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) return buildAuction(Seat.North, ["1NT", "P"]);
    return undefined;
  },
  declaredCapabilities: { [CAP_OPENING_1NT]: "active" },
  ruleModules: [naturalNtRules, jacobyTransfersRules],
  teaching: {
    purpose:
      "Transfer the contract to opener's hand when responder has a 5+ card major after 1NT opening",
    whenToUse:
      "Partner opens 1NT (15-17 HCP balanced). You have a 5+ card major suit.",
    whenNotToUse: [
      "Only a 4-card major — use Stayman instead",
      "No major suits — bid notrump directly",
    ],
    principle:
      "2D transfers to hearts, 2H transfers to spades — opener always accepts, making the strong hand declarer",
    roles:
      "Responder initiates the transfer; opener mechanically accepts; responder then decides the final contract level",
  },
});

export const bergenBundle = buildBundle({
  id: "bergen-bundle",
  name: "Bergen Raises (Bundle)",
  description: "Bergen Raises via the meaning pipeline — constructive, limit, game, preemptive, and splinter raises after 1M opening",
  category: ConventionCategory.Constructive,
  systemProfile: BERGEN_PROFILE,
  memberIds: ["bergen"],
  dealConstraints: {
    seats: [
      { seat: Seat.North, minHcp: 12, maxHcp: 21, minLength: { [Suit.Hearts]: 5 } },
      { seat: Seat.South, minHcp: 0, minLength: { [Suit.Hearts]: 4 } },
    ],
    dealer: Seat.North,
  },
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) return buildAuction(Seat.North, ["1H", "P"]);
    return undefined;
  },
  declaredCapabilities: { [CAP_OPENING_MAJOR]: "active" },
  ruleModules: [bergenRules],
  teaching: {
    purpose:
      "Show the right level of support when partner opens 1 of a major and you have 4+ card fit",
    whenToUse:
      "Partner opens 1H or 1S and you have 4+ cards in their major. Choose the raise level based on HCP: preemptive (0-6), constructive (7-10), limit (10-12), game (13+), or splinter (12+ with shortage).",
    whenNotToUse: [
      "Fewer than 4 cards in partner's major — look for other bids",
      "Passed hand — Bergen raises are off after a passed hand",
      "After opponent interference — standard raises apply instead",
    ],
    tradeoff:
      "3C and 3D lose their natural minor-suit meanings in favor of showing major support",
    principle:
      "With a known trump fit, bid to the level your combined strength supports — preempt with weakness, invite with middle values, bid game with strength",
    roles:
      "Opener evaluates whether the partnership has game after responder's Bergen bid",
  },
});

export const dontBundle = buildBundle({
  id: "dont-bundle",
  name: "DONT (Bundle)",
  description: "DONT — Disturbing Opponents' Notrump: competitive overcalls showing distributional hands",
  category: ConventionCategory.Defensive,
  systemProfile: DONT_PROFILE,
  memberIds: ["dont"],
  dealConstraints: {
    seats: [
      { seat: Seat.East, minHcp: 15, maxHcp: 17 },
      { seat: Seat.South, minHcp: 8, maxHcp: 15, minLengthAny: { [Suit.Clubs]: 5, [Suit.Diamonds]: 5, [Suit.Hearts]: 5, [Suit.Spades]: 5 } },
    ],
    dealer: Seat.East,
  },
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.West) return buildAuction(Seat.East, ["1NT"]);
    return undefined;
  },
  declaredCapabilities: { [CAP_OPPONENT_1NT]: "active" },
  ruleModules: [dontRules],
  allowedDealers: [Seat.East],
  teaching: {
    purpose:
      "Compete against opponent's 1NT opening with distributional hands, showing two-suited or single-suited holdings via conventional bids and doubles",
    whenToUse:
      "After opponent opens 1NT in direct seat: bid 2H with both majors (5-4+), 2D with diamonds + a major, 2C with clubs + a higher suit, 2S with 6+ natural spades, or double with any single long suit (6+, not spades).",
    whenNotToUse: [
      "In balancing seat (only direct seat overcall implemented)",
      "With a balanced hand lacking distributional shape",
      "With 4-4 or 5-3 shape (minimum 5-4 for two-suited, 6+ for single-suited)",
    ],
    tradeoff:
      "DONT sacrifices natural penalty doubles of 1NT in exchange for showing distributional hands at the 2-level",
    principle:
      "DONT uses conventional overcalls to describe shape (not strength), enabling partner to judge fit and level quickly. The double shows an unknown single suit via a relay mechanism.",
    roles:
      "Overcaller describes shape; advancer evaluates fit. After double, advancer must relay 2C to discover the suit.",
  },
});

export const weakTwoBundle = buildBundle({
  id: "weak-twos-bundle",
  name: "Weak Two Bids (Bundle)",
  description: "Weak Two Bids with Ogust 2NT — preemptive openings at the 2-level with structured hand description",
  category: ConventionCategory.Constructive,
  systemProfile: WEAK_TWO_PROFILE,
  memberIds: ["weak-twos"],
  dealConstraints: {
    seats: [
      { seat: Seat.North, minHcp: 5, maxHcp: 10, minLengthAny: { [Suit.Diamonds]: 6, [Suit.Hearts]: 6, [Suit.Spades]: 6 } },
      { seat: Seat.South, minHcp: 12 },
    ],
    dealer: Seat.North,
  },
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) return buildAuction(Seat.North, ["2H", "P"]);
    return undefined;
  },
  ruleModules: [weakTwosRules],
  allowedDealers: [Seat.North],
  teaching: {
    purpose:
      "Open light hands with a long suit at the 2-level to preempt opponents, and use the Ogust convention to describe hand strength and suit quality",
    whenToUse:
      "Open 2D/2H/2S with 6+ cards in the suit and 5-11 HCP. As responder, use 2NT (Ogust) to ask about opener's hand, raise to game with 16+ HCP and fit, or invite with 14-15 HCP and fit.",
    whenNotToUse: [
      "2C is reserved for strong openings — never open 2C as a weak two",
      "With a hand too strong for a weak two (12+ HCP) — open at the 1-level instead",
      "After opponent interference — standard competitive actions apply",
    ],
    tradeoff:
      "2-level openings lose their natural strong meaning in favor of preemptive action",
    principle:
      "Weak twos simultaneously obstruct opponents and describe a narrow hand type (6-card suit, limited strength) that partner can evaluate precisely",
    roles:
      "Opener describes; responder captains. After Ogust 2NT, opener further classifies along strength and quality dimensions",
  },
});

// ── Registry ────────────────────────────────────────────────────────

const ALL_BUNDLES: readonly ConventionBundle[] = [ntBundle, ntStaymanBundle, ntTransfersBundle, bergenBundle, dontBundle, weakTwoBundle];
const BUNDLE_MAP = new Map<string, ConventionBundle>(ALL_BUNDLES.map((b) => [b.id, b]));

/** Look up a convention bundle definition by ID. */
export function getSystemBundle(id: string): ConventionBundle | undefined {
  return BUNDLE_MAP.get(id);
}

/** List all convention bundle definitions. */
export function listSystemBundles(): readonly ConventionBundle[] {
  return ALL_BUNDLES;
}

// ── Backward-compatible aliases (used by consumers during migration) ──

/** @deprecated Use getSystemBundle() */
export function getSystem(id: string): ConventionBundle | undefined {
  return getSystemBundle(id);
}

/** @deprecated Use listSystemBundles() */
export function listSystems(): readonly ConventionBundle[] {
  return ALL_BUNDLES;
}

// ── Spec generation ──────────────────────────────────────────────────

/** Derive a ConventionSpec from a ConventionBundle.
 *  Creates a minimal spec with ruleModules for surface selection.
 *  Returns undefined if no ruleModules are present. */
export function specFromBundle(bundle: ConventionBundle): ConventionSpec | undefined {
  if (bundle.ruleModules && bundle.ruleModules.length > 0) {
    return {
      id: bundle.id,
      name: bundle.name,
      schema: { registers: {}, capabilities: {} },
      modules: [],
      surfaces: {},
      ruleModules: bundle.ruleModules,
    };
  }

  return undefined;
}

/** @deprecated Use specFromBundle() */
export function specFromSystem(bundle: ConventionBundle): ConventionSpec | undefined {
  return specFromBundle(bundle);
}
