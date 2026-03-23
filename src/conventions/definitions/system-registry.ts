/**
 * Bundle Registry — central definitions for all convention bundles.
 *
 * The registry stores authored BundleInput definitions only (no modules).
 * Consumers call resolveBundle(input, sys) to get a full ConventionBundle
 * with modules resolved for a specific SystemConfig.
 *
 * Deal constraints are DERIVED from capabilities + R1 surface analysis —
 * no hand-authored dealConstraints, factories, or defaultAuction.
 *
 * SystemConfig is always external — never baked into bundle definitions.
 */

import type { ConventionBundle, BundleInput } from "../core/bundle/bundle-types";
import type { ConventionSpec } from "../core/protocol/types";
import type { SystemConfig } from "../../core/contracts/system-config";
import type { ConventionModule } from "../core/convention-module";
import type { SurfaceGroup } from "../../core/contracts/teaching-grading";
import { getModules } from "./module-registry";
import { deriveBundleDealConstraints } from "./derive-deal-constraints";

import { ConventionCategory } from "../../core/contracts/convention";
import { CAP_OPENING_1NT, CAP_OPENING_MAJOR, CAP_OPENING_WEAK_TWO, CAP_OPPONENT_1NT } from "./capability-vocabulary";
import { NT_SAYC_PROFILE, NT_STAYMAN_ONLY_PROFILE, NT_TRANSFERS_ONLY_PROFILE } from "./nt-bundle/system-profile";
import { BERGEN_PROFILE } from "./bergen-bundle/system-profile";
import { DONT_PROFILE } from "./dont-bundle/system-profile";
import { WEAK_TWO_PROFILE } from "./weak-twos-bundle/system-profile";

// ── Module aggregation ──────────────────────────────────────────────

/** Aggregate teaching/grading content from resolved modules. */
function aggregateTeachingContent(modules: readonly ConventionModule[]): {
  surfaceGroups: readonly SurfaceGroup[];
} {
  return {
    surfaceGroups: deriveSurfaceGroupsFromModules(modules),
  };
}

/**
 * Auto-derive SurfaceGroups from module rule structure.
 * Each rule with 2+ claims represents surfaces competing at the same
 * decision point — a natural SurfaceGroup with mutually_exclusive relationship.
 */
function deriveSurfaceGroupsFromModules(
  modules: readonly ConventionModule[],
): SurfaceGroup[] {
  const families: SurfaceGroup[] = [];

  for (const mod of modules) {
    for (const entry of (mod.states ?? [])) {
      if (entry.surfaces.length < 2) continue;
      const members = entry.surfaces.map((s) => s.meaningId);
      const localPhase: string = Array.isArray(entry.phase)
        ? (entry.phase as readonly string[]).join("|")
        : String(entry.phase);
      const turn: string = entry.turn ?? "any";
      const id = `${mod.moduleId}/${localPhase}:${turn}`;
      families.push({
        id,
        label: `${mod.moduleId} ${localPhase} (${turn})`,
        members,
        relationship: "mutually_exclusive",
        description: `Surfaces competing at ${localPhase} in ${mod.moduleId} (${turn}'s turn)`,
      });
    }
  }

  return families;
}

// ── Bundle definitions (BundleInput — no modules, no constraints) ────

const ntBundleInput: BundleInput = {
  id: "nt-bundle",
  name: "1NT Responses",
  description: "Full 1NT response system: Stayman + Jacoby Transfers + Smolen + natural bids — practice choosing between conventions",
  category: ConventionCategory.Constructive,
  systemProfile: NT_SAYC_PROFILE,
  memberIds: ["natural-nt", "stayman", "jacoby-transfers", "smolen"],
  declaredCapabilities: { [CAP_OPENING_1NT]: "active" },
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
};

const ntStaymanInput: BundleInput = {
  id: "nt-stayman",
  name: "Stayman",
  description: "Stayman convention — find a 4-4 major fit after 1NT opening",
  category: ConventionCategory.Asking,
  systemProfile: NT_STAYMAN_ONLY_PROFILE,
  memberIds: ["natural-nt", "stayman"],
  declaredCapabilities: { [CAP_OPENING_1NT]: "active" },
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
};

const ntTransfersInput: BundleInput = {
  id: "nt-transfers",
  name: "Jacoby Transfers",
  description: "Jacoby Transfers — ensure the strong hand declares in a major-suit contract",
  category: ConventionCategory.Constructive,
  systemProfile: NT_TRANSFERS_ONLY_PROFILE,
  memberIds: ["natural-nt", "jacoby-transfers"],
  declaredCapabilities: { [CAP_OPENING_1NT]: "active" },
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
};

const bergenInput: BundleInput = {
  id: "bergen-bundle",
  name: "Bergen Raises (Bundle)",
  description: "Bergen Raises via the meaning pipeline — constructive, limit, game, preemptive, and splinter raises after 1M opening",
  category: ConventionCategory.Constructive,
  systemProfile: BERGEN_PROFILE,
  memberIds: ["bergen"],
  declaredCapabilities: { [CAP_OPENING_MAJOR]: "active" },
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
};

const dontInput: BundleInput = {
  id: "dont-bundle",
  name: "DONT (Bundle)",
  description: "DONT — Disturbing Opponents' Notrump: competitive overcalls showing distributional hands",
  category: ConventionCategory.Defensive,
  systemProfile: DONT_PROFILE,
  memberIds: ["dont"],
  declaredCapabilities: { [CAP_OPPONENT_1NT]: "active" },
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
};

const weakTwoInput: BundleInput = {
  id: "weak-twos-bundle",
  name: "Weak Two Bids (Bundle)",
  description: "Weak Two Bids with Ogust 2NT — preemptive openings at the 2-level with structured hand description",
  category: ConventionCategory.Constructive,
  systemProfile: WEAK_TWO_PROFILE,
  memberIds: ["weak-twos"],
  declaredCapabilities: { [CAP_OPENING_WEAK_TWO]: "active" },
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
};

// ── Registry stores authored input only ──────────────────────────────

const ALL_INPUTS: readonly BundleInput[] = [ntBundleInput, ntStaymanInput, ntTransfersInput, bergenInput, dontInput, weakTwoInput];
const INPUT_MAP = new Map<string, BundleInput>(ALL_INPUTS.map(b => [b.id, b]));

/** Look up a bundle's authored definition (no modules). */
export function getBundleInput(id: string): BundleInput | undefined {
  return INPUT_MAP.get(id);
}

/** List all bundle definitions. */
export function listBundleInputs(): readonly BundleInput[] {
  return ALL_INPUTS;
}

// ── Resolution: input + system → full bundle ─────────────────────────

/** Resolve a BundleInput into a full ConventionBundle for a specific system. */
export function resolveBundle(input: BundleInput, sys: SystemConfig): ConventionBundle {
  const modules = getModules(input.memberIds, sys);
  const { surfaceGroups } = aggregateTeachingContent(modules);

  // Derive deal constraints from authored convention data
  const derived = deriveBundleDealConstraints(input, modules, sys);

  return {
    ...input,
    ...derived,
    modules,
    derivedTeaching: { surfaceGroups },
  };
}

/** Derive a ConventionSpec from a BundleInput for a specific system. */
export function specFromBundle(
  input: BundleInput,
  sys: SystemConfig,
): ConventionSpec | undefined {
  const modules = getModules(input.memberIds, sys);
  if (modules.length === 0) return undefined;
  return {
    id: input.id,
    name: input.name,
    modules,
    systemConfig: sys,
  };
}
