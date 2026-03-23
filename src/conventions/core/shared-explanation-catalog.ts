/**
 * Platform shared-fact explanation catalog.
 *
 * Provides FactExplanationEntry instances for every shared fact (primitive,
 * bridge-derived, posterior-derived) and every system fact. Convention
 * modules that reference these facts in surface clauses get explanations
 * "for free" from this catalog instead of duplicating entries.
 */

import type { FactExplanationEntry } from "../../core/contracts/explanation-catalog";
import {
  PRIMITIVE_FACT_IDS,
  BRIDGE_DERIVED_FACT_IDS,
  POSTERIOR_FACT_IDS,
} from "../../core/contracts/shared-fact-vocabulary";
import type { SharedFactId } from "../../core/contracts/shared-fact-vocabulary";
import {
  SYSTEM_RESPONDER_WEAK_HAND,
  SYSTEM_RESPONDER_INVITE_VALUES,
  SYSTEM_RESPONDER_GAME_VALUES,
  SYSTEM_RESPONDER_SLAM_VALUES,
  SYSTEM_OPENER_NOT_MINIMUM,
  SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT,
  SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING,
  SYSTEM_ONE_NT_FORCING_AFTER_MAJOR,
  SYSTEM_RESPONDER_ONE_NT_RANGE,
  SYSTEM_DONT_OVERCALL_IN_RANGE,
} from "../../core/contracts/system-fact-vocabulary";
import type { SystemFactId } from "../../core/contracts/system-fact-vocabulary";

type PlatformFactId = SharedFactId | SystemFactId;

// ─── Primitive fact explanations ──────────────────────────────

const PRIMITIVE_EXPLANATIONS: Record<
  (typeof PRIMITIVE_FACT_IDS)[keyof typeof PRIMITIVE_FACT_IDS],
  FactExplanationEntry
> = {
  [PRIMITIVE_FACT_IDS.HAND_HCP]: {
    explanationId: "platform.hand.hcp",
    factId: PRIMITIVE_FACT_IDS.HAND_HCP,
    templateKey: "platform.hand.hcp",
    displayText: "High card points (A=4, K=3, Q=2, J=1)",
    contrastiveTemplateKey: "platform.hand.hcp.contrast",
    contrastiveDisplayText: "Not enough high card points",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
  [PRIMITIVE_FACT_IDS.HAND_SUIT_LENGTH_SPADES]: {
    explanationId: "platform.hand.suitLength.spades",
    factId: PRIMITIVE_FACT_IDS.HAND_SUIT_LENGTH_SPADES,
    templateKey: "platform.hand.suitLength.spades",
    displayText: "Number of spades held",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
  [PRIMITIVE_FACT_IDS.HAND_SUIT_LENGTH_HEARTS]: {
    explanationId: "platform.hand.suitLength.hearts",
    factId: PRIMITIVE_FACT_IDS.HAND_SUIT_LENGTH_HEARTS,
    templateKey: "platform.hand.suitLength.hearts",
    displayText: "Number of hearts held",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
  [PRIMITIVE_FACT_IDS.HAND_SUIT_LENGTH_DIAMONDS]: {
    explanationId: "platform.hand.suitLength.diamonds",
    factId: PRIMITIVE_FACT_IDS.HAND_SUIT_LENGTH_DIAMONDS,
    templateKey: "platform.hand.suitLength.diamonds",
    displayText: "Number of diamonds held",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
  [PRIMITIVE_FACT_IDS.HAND_SUIT_LENGTH_CLUBS]: {
    explanationId: "platform.hand.suitLength.clubs",
    factId: PRIMITIVE_FACT_IDS.HAND_SUIT_LENGTH_CLUBS,
    templateKey: "platform.hand.suitLength.clubs",
    displayText: "Number of clubs held",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
  [PRIMITIVE_FACT_IDS.HAND_IS_BALANCED]: {
    explanationId: "platform.hand.isBalanced",
    factId: PRIMITIVE_FACT_IDS.HAND_IS_BALANCED,
    templateKey: "platform.hand.isBalanced",
    displayText: "Hand shape is balanced (4-3-3-3, 4-4-3-2, or 5-3-3-2)",
    contrastiveTemplateKey: "platform.hand.isBalanced.contrast",
    contrastiveDisplayText: "Hand shape is unbalanced",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
};

// ─── Bridge-derived fact explanations ─────────────────────────

const BRIDGE_DERIVED_EXPLANATIONS: Record<
  (typeof BRIDGE_DERIVED_FACT_IDS)[keyof typeof BRIDGE_DERIVED_FACT_IDS],
  FactExplanationEntry
> = {
  [BRIDGE_DERIVED_FACT_IDS.BRIDGE_IS_VULNERABLE]: {
    explanationId: "platform.bridge.isVulnerable",
    factId: BRIDGE_DERIVED_FACT_IDS.BRIDGE_IS_VULNERABLE,
    templateKey: "platform.bridge.isVulnerable",
    displayText: "Your side is vulnerable (higher penalties, higher bonuses)",
    contrastiveTemplateKey: "platform.bridge.isVulnerable.contrast",
    contrastiveDisplayText: "Your side is not vulnerable",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [BRIDGE_DERIVED_FACT_IDS.BRIDGE_HAS_FOUR_CARD_MAJOR]: {
    explanationId: "platform.bridge.hasFourCardMajor",
    factId: BRIDGE_DERIVED_FACT_IDS.BRIDGE_HAS_FOUR_CARD_MAJOR,
    templateKey: "platform.bridge.hasFourCardMajor",
    displayText: "Has at least one 4-card major suit",
    contrastiveTemplateKey: "platform.bridge.hasFourCardMajor.contrast",
    contrastiveDisplayText: "No 4-card major suit",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [BRIDGE_DERIVED_FACT_IDS.BRIDGE_HAS_FIVE_CARD_MAJOR]: {
    explanationId: "platform.bridge.hasFiveCardMajor",
    factId: BRIDGE_DERIVED_FACT_IDS.BRIDGE_HAS_FIVE_CARD_MAJOR,
    templateKey: "platform.bridge.hasFiveCardMajor",
    displayText: "Has at least one 5-card major suit",
    contrastiveTemplateKey: "platform.bridge.hasFiveCardMajor.contrast",
    contrastiveDisplayText: "No 5-card major suit",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [BRIDGE_DERIVED_FACT_IDS.BRIDGE_MAJOR_PATTERN]: {
    explanationId: "platform.bridge.majorPattern",
    factId: BRIDGE_DERIVED_FACT_IDS.BRIDGE_MAJOR_PATTERN,
    templateKey: "platform.bridge.majorPattern",
    displayText: "Major suit distribution pattern",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [BRIDGE_DERIVED_FACT_IDS.BRIDGE_SUPPORT_FOR_BOUND_SUIT]: {
    explanationId: "platform.bridge.supportForBoundSuit",
    factId: BRIDGE_DERIVED_FACT_IDS.BRIDGE_SUPPORT_FOR_BOUND_SUIT,
    templateKey: "platform.bridge.supportForBoundSuit",
    displayText: "Card length in partner's suit",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [BRIDGE_DERIVED_FACT_IDS.BRIDGE_FIT_WITH_BOUND_SUIT]: {
    explanationId: "platform.bridge.fitWithBoundSuit",
    factId: BRIDGE_DERIVED_FACT_IDS.BRIDGE_FIT_WITH_BOUND_SUIT,
    templateKey: "platform.bridge.fitWithBoundSuit",
    displayText: "Combined 8+ cards in the agreed suit (a fit)",
    contrastiveTemplateKey: "platform.bridge.fitWithBoundSuit.contrast",
    contrastiveDisplayText: "Fewer than 8 combined cards in the suit (no fit)",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [BRIDGE_DERIVED_FACT_IDS.BRIDGE_HAS_SHORTAGE]: {
    explanationId: "platform.bridge.hasShortage",
    factId: BRIDGE_DERIVED_FACT_IDS.BRIDGE_HAS_SHORTAGE,
    templateKey: "platform.bridge.hasShortage",
    displayText: "Has a singleton or void (shortage)",
    contrastiveTemplateKey: "platform.bridge.hasShortage.contrast",
    contrastiveDisplayText: "No singleton or void",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [BRIDGE_DERIVED_FACT_IDS.BRIDGE_SHORTAGE_IN_SUIT]: {
    explanationId: "platform.bridge.shortageInSuit",
    factId: BRIDGE_DERIVED_FACT_IDS.BRIDGE_SHORTAGE_IN_SUIT,
    templateKey: "platform.bridge.shortageInSuit",
    displayText: "Singleton or void in a specific suit",
    contrastiveTemplateKey: "platform.bridge.shortageInSuit.contrast",
    contrastiveDisplayText: "No shortage in that suit",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [BRIDGE_DERIVED_FACT_IDS.BRIDGE_TOTAL_POINTS_FOR_RAISE]: {
    explanationId: "platform.bridge.totalPointsForRaise",
    factId: BRIDGE_DERIVED_FACT_IDS.BRIDGE_TOTAL_POINTS_FOR_RAISE,
    templateKey: "platform.bridge.totalPointsForRaise",
    displayText: "Total points for a raise (HCP + shortage points)",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
};

// ─── Posterior-derived fact explanations ───────────────────────

const POSTERIOR_EXPLANATIONS: Record<
  (typeof POSTERIOR_FACT_IDS)[keyof typeof POSTERIOR_FACT_IDS],
  FactExplanationEntry
> = {
  [POSTERIOR_FACT_IDS.BRIDGE_PARTNER_HAS_4_HEARTS_LIKELY]: {
    explanationId: "platform.posterior.partnerHas4Hearts",
    factId: POSTERIOR_FACT_IDS.BRIDGE_PARTNER_HAS_4_HEARTS_LIKELY,
    templateKey: "platform.posterior.partnerHas4Hearts",
    displayText: "Partner likely holds 4+ hearts",
    contrastiveTemplateKey: "platform.posterior.partnerHas4Hearts.contrast",
    contrastiveDisplayText: "Partner unlikely to hold 4+ hearts",
    preferredLevel: "semantic",
    roles: ["inferential"],
  },
  [POSTERIOR_FACT_IDS.BRIDGE_PARTNER_HAS_4_SPADES_LIKELY]: {
    explanationId: "platform.posterior.partnerHas4Spades",
    factId: POSTERIOR_FACT_IDS.BRIDGE_PARTNER_HAS_4_SPADES_LIKELY,
    templateKey: "platform.posterior.partnerHas4Spades",
    displayText: "Partner likely holds 4+ spades",
    contrastiveTemplateKey: "platform.posterior.partnerHas4Spades.contrast",
    contrastiveDisplayText: "Partner unlikely to hold 4+ spades",
    preferredLevel: "semantic",
    roles: ["inferential"],
  },
  [POSTERIOR_FACT_IDS.BRIDGE_PARTNER_HAS_4_DIAMONDS_LIKELY]: {
    explanationId: "platform.posterior.partnerHas4Diamonds",
    factId: POSTERIOR_FACT_IDS.BRIDGE_PARTNER_HAS_4_DIAMONDS_LIKELY,
    templateKey: "platform.posterior.partnerHas4Diamonds",
    displayText: "Partner likely holds 4+ diamonds",
    contrastiveTemplateKey: "platform.posterior.partnerHas4Diamonds.contrast",
    contrastiveDisplayText: "Partner unlikely to hold 4+ diamonds",
    preferredLevel: "semantic",
    roles: ["inferential"],
  },
  [POSTERIOR_FACT_IDS.BRIDGE_PARTNER_HAS_4_CLUBS_LIKELY]: {
    explanationId: "platform.posterior.partnerHas4Clubs",
    factId: POSTERIOR_FACT_IDS.BRIDGE_PARTNER_HAS_4_CLUBS_LIKELY,
    templateKey: "platform.posterior.partnerHas4Clubs",
    displayText: "Partner likely holds 4+ clubs",
    contrastiveTemplateKey: "platform.posterior.partnerHas4Clubs.contrast",
    contrastiveDisplayText: "Partner unlikely to hold 4+ clubs",
    preferredLevel: "semantic",
    roles: ["inferential"],
  },
  [POSTERIOR_FACT_IDS.BRIDGE_COMBINED_HCP_IN_RANGE_LIKELY]: {
    explanationId: "platform.posterior.combinedHcpInRange",
    factId: POSTERIOR_FACT_IDS.BRIDGE_COMBINED_HCP_IN_RANGE_LIKELY,
    templateKey: "platform.posterior.combinedHcpInRange",
    displayText: "Combined partnership HCP likely in the target range",
    contrastiveTemplateKey: "platform.posterior.combinedHcpInRange.contrast",
    contrastiveDisplayText: "Combined partnership HCP unlikely in the target range",
    preferredLevel: "semantic",
    roles: ["inferential"],
  },
};

// ─── System fact explanations ─────────────────────────────────

const SYSTEM_EXPLANATIONS: Record<SystemFactId, FactExplanationEntry> = {
  [SYSTEM_RESPONDER_WEAK_HAND]: {
    explanationId: "platform.system.responder.weakHand",
    factId: SYSTEM_RESPONDER_WEAK_HAND,
    templateKey: "platform.system.responder.weakHand",
    displayText: "Hand is below the invitational threshold",
    contrastiveTemplateKey: "platform.system.responder.weakHand.contrast",
    contrastiveDisplayText: "Hand has enough strength to act",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [SYSTEM_RESPONDER_INVITE_VALUES]: {
    explanationId: "platform.system.responder.inviteValues",
    factId: SYSTEM_RESPONDER_INVITE_VALUES,
    templateKey: "platform.system.responder.inviteValues",
    displayText: "Enough points to invite game",
    contrastiveTemplateKey: "platform.system.responder.inviteValues.contrast",
    contrastiveDisplayText: "Not enough points to invite game",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [SYSTEM_RESPONDER_GAME_VALUES]: {
    explanationId: "platform.system.responder.gameValues",
    factId: SYSTEM_RESPONDER_GAME_VALUES,
    templateKey: "platform.system.responder.gameValues",
    displayText: "Enough points to bid game",
    contrastiveTemplateKey: "platform.system.responder.gameValues.contrast",
    contrastiveDisplayText: "Not enough points to bid game",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [SYSTEM_RESPONDER_SLAM_VALUES]: {
    explanationId: "platform.system.responder.slamValues",
    factId: SYSTEM_RESPONDER_SLAM_VALUES,
    templateKey: "platform.system.responder.slamValues",
    displayText: "Enough points to explore slam",
    contrastiveTemplateKey: "platform.system.responder.slamValues.contrast",
    contrastiveDisplayText: "Not enough points to explore slam",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [SYSTEM_OPENER_NOT_MINIMUM]: {
    explanationId: "platform.system.opener.notMinimum",
    factId: SYSTEM_OPENER_NOT_MINIMUM,
    templateKey: "platform.system.opener.notMinimum",
    displayText: "Opener has more than minimum strength",
    contrastiveTemplateKey: "platform.system.opener.notMinimum.contrast",
    contrastiveDisplayText: "Opener has minimum strength",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT]: {
    explanationId: "platform.system.responder.twoLevelNewSuit",
    factId: SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT,
    templateKey: "platform.system.responder.twoLevelNewSuit",
    displayText: "Enough points for a 2-level new-suit response",
    contrastiveTemplateKey: "platform.system.responder.twoLevelNewSuit.contrast",
    contrastiveDisplayText: "Not enough points for a 2-level new-suit response",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING]: {
    explanationId: "platform.system.suitResponse.isGameForcing",
    factId: SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING,
    templateKey: "platform.system.suitResponse.isGameForcing",
    displayText: "A 2-level new-suit response is game-forcing",
    contrastiveTemplateKey: "platform.system.suitResponse.isGameForcing.contrast",
    contrastiveDisplayText: "A 2-level new-suit response is not game-forcing",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [SYSTEM_ONE_NT_FORCING_AFTER_MAJOR]: {
    explanationId: "platform.system.oneNtResponseAfterMajor.forcing",
    factId: SYSTEM_ONE_NT_FORCING_AFTER_MAJOR,
    templateKey: "platform.system.oneNtResponseAfterMajor.forcing",
    displayText: "1NT response to a major is forcing in this system",
    contrastiveTemplateKey: "platform.system.oneNtResponseAfterMajor.forcing.contrast",
    contrastiveDisplayText: "1NT response to a major is not forcing",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [SYSTEM_RESPONDER_ONE_NT_RANGE]: {
    explanationId: "platform.system.responder.oneNtRange",
    factId: SYSTEM_RESPONDER_ONE_NT_RANGE,
    templateKey: "platform.system.responder.oneNtRange",
    displayText: "Within the HCP range for a 1NT response to partner's major",
    contrastiveTemplateKey: "platform.system.responder.oneNtRange.contrast",
    contrastiveDisplayText: "Outside the HCP range for a 1NT response",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [SYSTEM_DONT_OVERCALL_IN_RANGE]: {
    explanationId: "platform.system.dontOvercall.inRange",
    factId: SYSTEM_DONT_OVERCALL_IN_RANGE,
    templateKey: "platform.system.dontOvercall.inRange",
    displayText: "HCP is within the DONT overcall range",
    contrastiveTemplateKey: "platform.system.dontOvercall.inRange.contrast",
    contrastiveDisplayText: "HCP is outside the DONT overcall range",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
};

// ─── Combined catalog ─────────────────────────────────────────

const PLATFORM_FACT_EXPLANATIONS: Record<PlatformFactId, FactExplanationEntry> = {
  ...PRIMITIVE_EXPLANATIONS,
  ...BRIDGE_DERIVED_EXPLANATIONS,
  ...POSTERIOR_EXPLANATIONS,
  ...SYSTEM_EXPLANATIONS,
};

/** All platform-level fact explanation entries (shared + system facts). */
export const PLATFORM_EXPLANATION_ENTRIES: readonly FactExplanationEntry[] =
  Object.values(PLATFORM_FACT_EXPLANATIONS);
