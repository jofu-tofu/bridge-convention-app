/**
 * System Registry — central lookup for all bidding systems.
 *
 * Each bidding system is a thin composition of modules via a system profile.
 * Teaching/grading metadata is aggregated from the module registry.
 * A backward-compatible `bundleFromSystem()` function derives ConventionBundle
 * for code that hasn't been migrated yet.
 */

import type { BiddingSystem } from "./bidding-system";
import type { ConventionBundle } from "../core/bundle/bundle-types";
import type { ConventionSpec } from "../core/protocol/types";
import type { RuleModule } from "../core/rule-module";
import type { MeaningSurface } from "../../core/contracts/meaning";
import type { ExplanationCatalogIR } from "../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../core/contracts/teaching-projection";
import type { AlternativeGroup, IntentFamily } from "../../core/contracts/tree-evaluation";
import { createExplanationCatalog } from "../../core/contracts/explanation-catalog";
import { getModules } from "./module-registry";
import { derivePedagogicalContent } from "./derive-cross-module";
import { composeModules } from "../core/composition/compose-modules";
import { assembleConventionSpec } from "../core/protocol/spec-assembler";

// ── System definitions ──────────────────────────────────────────────

import { Seat, Suit } from "../../engine/types";
import { ConventionCategory } from "../../core/contracts/convention";
import { CAP_OPENING_1NT, CAP_OPENING_MAJOR, CAP_OPPONENT_1NT } from "./capability-vocabulary";
import { buildAuction } from "../../engine/auction-helpers";
import { NT_SAYC_PROFILE, NT_STAYMAN_ONLY_PROFILE, NT_TRANSFERS_ONLY_PROFILE } from "./nt-bundle/system-profile";
import { NT_SKELETON } from "./nt-bundle/skeleton";
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
const ntSystem: BiddingSystem = {
  id: "nt-bundle",
  name: "1NT Response Bundle",
  description: "Stayman + Jacoby Transfers + Smolen responses to 1NT opening",
  category: ConventionCategory.Constructive,
  profile: NT_SAYC_PROFILE,
  moduleIds: ["natural-nt", "stayman", "jacoby-transfers", "smolen"],
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
  skeleton: NT_SKELETON,
  ruleModules: [naturalNtRules, staymanRules, jacobyTransfersRules, smolenRules],
};

const ntStaymanSystem: BiddingSystem = {
  id: "nt-stayman",
  name: "Stayman Only",
  description: "Practice Stayman responses to 1NT opening (no Jacoby Transfers)",
  category: ConventionCategory.Asking,
  profile: NT_STAYMAN_ONLY_PROFILE,
  moduleIds: ["natural-nt", "stayman"],
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
  skeleton: NT_SKELETON,
};

const ntTransfersSystem: BiddingSystem = {
  id: "nt-transfers",
  name: "Jacoby Transfers Only",
  description: "Practice Jacoby Transfer responses to 1NT opening (no Stayman)",
  category: ConventionCategory.Constructive,
  profile: NT_TRANSFERS_ONLY_PROFILE,
  moduleIds: ["natural-nt", "jacoby-transfers"],
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
  skeleton: NT_SKELETON,
};

const bergenSystem: BiddingSystem = {
  id: "bergen-bundle",
  name: "Bergen Raises Bundle",
  description: "Bergen Raises — constructive, limit, and preemptive responses to 1M opening",
  category: ConventionCategory.Constructive,
  profile: BERGEN_PROFILE,
  moduleIds: ["bergen"],
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
};

const dontSystem: BiddingSystem = {
  id: "dont-bundle",
  name: "DONT Bundle",
  description: "DONT (Disturbing Opponents' Notrump) — competitive overcalls after opponent's 1NT",
  category: ConventionCategory.Defensive,
  profile: DONT_PROFILE,
  moduleIds: ["dont"],
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
};

const weakTwosSystem: BiddingSystem = {
  id: "weak-twos-bundle",
  name: "Weak Two Bundle",
  description: "Weak Two openings (2D/2H/2S) with Ogust responses",
  category: ConventionCategory.Constructive,
  profile: WEAK_TWO_PROFILE,
  moduleIds: ["weak-twos"],
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
};

// ── Registry ────────────────────────────────────────────────────────

const ALL_SYSTEMS: readonly BiddingSystem[] = [ntSystem, ntStaymanSystem, ntTransfersSystem, bergenSystem, dontSystem, weakTwosSystem];
const SYSTEM_MAP = new Map<string, BiddingSystem>(ALL_SYSTEMS.map((s) => [s.id, s]));

/** Look up a bidding system by ID. */
export function getSystem(id: string): BiddingSystem | undefined {
  return SYSTEM_MAP.get(id);
}

/** List all registered bidding systems. */
export function listSystems(): readonly BiddingSystem[] {
  return ALL_SYSTEMS;
}

// ── Module aggregation ──────────────────────────────────────────────

/** Aggregate teaching/grading content from a system's modules. */
export function aggregateModuleContent(system: BiddingSystem): {
  explanationCatalog: ExplanationCatalogIR;
  pedagogicalRelations: readonly PedagogicalRelation[];
  acceptableAlternatives: readonly AlternativeGroup[];
  intentFamilies: readonly IntentFamily[];
} {
  const modules = getModules(system.moduleIds);
  const derived = derivePedagogicalContent(modules);
  return {
    explanationCatalog: createExplanationCatalog(
      modules.flatMap((m) => m.explanationEntries),
    ),
    pedagogicalRelations: derived.relations,
    acceptableAlternatives: derived.alternatives,
    intentFamilies: derived.intentFamilies,
  };
}

// ── Bundle + Spec generation ──────────────────────────────────────────

/** Derive a ConventionBundle from a BiddingSystem + module registry.
 *  Prefers ruleModules when available; falls back to skeleton+composeModules. */
export function bundleFromSystem(system: BiddingSystem): ConventionBundle {
  const { explanationCatalog, pedagogicalRelations, acceptableAlternatives, intentFamilies } =
    aggregateModuleContent(system);

  const base: ConventionBundle = {
    id: system.id,
    name: system.name,
    description: system.description,
    category: system.category,
    internal: system.internal,
    memberIds: system.moduleIds,
    dealConstraints: system.dealConstraints,
    offConventionConstraints: system.offConventionConstraints,
    defaultAuction: system.defaultAuction,
    declaredCapabilities: system.declaredCapabilities,
    systemProfile: system.profile,
    explanationCatalog,
    pedagogicalRelations,
    acceptableAlternatives,
    intentFamilies,
  };

  // Prefer rule modules — collects surfaces/facts/explanations directly
  if (system.ruleModules && system.ruleModules.length > 0) {
    return { ...base, ...bundleFromRuleModules(system.ruleModules) };
  }

  // Fallback: skeleton + composeModules (legacy path)
  if (system.skeleton) {
    const modules = getModules(system.moduleIds);
    const composed = composeModules(
      modules,
      system.skeleton,
      system.id,
      system.name,
    );
    return {
      ...base,
      meaningSurfaces: composed.meaningSurfaceGroups,
      factExtensions: [composed.mergedFacts],
    };
  }

  return base;
}

/**
 * Collect surfaces, facts, and explanations directly from RuleModule[].
 * No FSM or skeleton needed — rules are the sole source of convention logic.
 */
function bundleFromRuleModules(
  ruleModules: readonly RuleModule[],
): Pick<ConventionBundle, "meaningSurfaces" | "factExtensions"> {
  // Collect all surfaces from rule claims, grouped by module
  const surfaceGroups: { groupId: string; surfaces: MeaningSurface[] }[] = [];
  const seenMeaningIds = new Set<string>();

  for (const mod of ruleModules) {
    const moduleSurfaces: MeaningSurface[] = [];
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

  // Collect fact extensions from each module
  const factExtensions = ruleModules
    .map((m) => m.facts)
    .filter((f) => f.definitions.length > 0 || f.evaluators.size > 0);

  return {
    meaningSurfaces: surfaceGroups,
    factExtensions,
  };
}

/** Derive a ConventionSpec from a BiddingSystem.
 *  When the system has a skeleton, composes via FSM. When it has ruleModules
 *  but no skeleton, creates a minimal spec with just ruleModules.
 *  Returns undefined if neither skeleton nor ruleModules are present. */
export function specFromSystem(system: BiddingSystem): ConventionSpec | undefined {
  if (system.skeleton) {
    const modules = getModules(system.moduleIds);
    const composed = composeModules(
      modules,
      system.skeleton,
      system.id,
      system.name,
    );

    const spec = assembleConventionSpec({
      id: system.id,
      name: system.name,
      modules: [
        {
          module: composed.baseTrack,
          surfaces: composed.surfaceFragments,
        },
      ],
    });

    // Attach rule modules if the system defines them
    if (system.ruleModules) {
      return { ...spec, ruleModules: system.ruleModules };
    }

    return spec;
  }

  // No skeleton — create a minimal spec from ruleModules alone
  if (system.ruleModules && system.ruleModules.length > 0) {
    return {
      id: system.id,
      name: system.name,
      schema: { registers: {}, capabilities: {} },
      modules: [],
      surfaces: {},
      ruleModules: system.ruleModules,
    };
  }

  return undefined;
}

// Re-export system definitions for direct access
export { ntSystem, ntStaymanSystem, ntTransfersSystem, bergenSystem, dontSystem, weakTwosSystem };
