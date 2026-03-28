import type {
  ExplanationEntry,
  FactExplanationEntry,
  MeaningExplanationEntry,
} from "../../../core/explanation-catalog";
import { BLACKWOOD_FACT_IDS, BLACKWOOD_MEANING_IDS } from "./ids";
import type { BlackwoodFactId, BlackwoodMeaningId } from "./ids";

// ─── Fact explanations (Record-exhaustive) ──────────────────

const FACT_EXPLANATIONS: Record<BlackwoodFactId, FactExplanationEntry> = {
  [BLACKWOOD_FACT_IDS.SLAM_INTEREST]: {
    explanationId: "blackwood.slamInterest",
    factId: BLACKWOOD_FACT_IDS.SLAM_INTEREST,
    templateKey: "blackwood.slamInterest.supporting",
    displayText: "Hand has slam interest (enough combined strength for slam)",
    contrastiveTemplateKey: "blackwood.slamInterest.whyNot",
    contrastiveDisplayText: "Not enough strength for slam exploration",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking", "pedagogical"],
  },
  [BLACKWOOD_FACT_IDS.ACE_COUNT]: {
    explanationId: "blackwood.aceCount",
    factId: BLACKWOOD_FACT_IDS.ACE_COUNT,
    templateKey: "blackwood.aceCount.mechanical",
    displayText: "Number of aces held",
    preferredLevel: "mechanical",
    roles: ["supporting"],
  },
  [BLACKWOOD_FACT_IDS.KING_COUNT]: {
    explanationId: "blackwood.kingCount",
    factId: BLACKWOOD_FACT_IDS.KING_COUNT,
    templateKey: "blackwood.kingCount.mechanical",
    displayText: "Number of kings held",
    preferredLevel: "mechanical",
    roles: ["supporting"],
  },
};

// ─── Meaning explanations (Record-exhaustive) ───────────────

const MEANING_EXPLANATIONS: Record<BlackwoodMeaningId, MeaningExplanationEntry> = {
  [BLACKWOOD_MEANING_IDS.ASK_ACES]: {
    explanationId: "blackwood.askAces",
    meaningId: BLACKWOOD_MEANING_IDS.ASK_ACES,
    templateKey: "blackwood.askAces.semantic",
    displayText: "Blackwood 4NT: asks partner how many aces they hold",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BLACKWOOD_MEANING_IDS.RESPONSE_0_ACES]: {
    explanationId: "blackwood.response0Aces",
    meaningId: BLACKWOOD_MEANING_IDS.RESPONSE_0_ACES,
    templateKey: "blackwood.response0Aces.semantic",
    displayText: "5♣ shows 0 (or 4) aces",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BLACKWOOD_MEANING_IDS.RESPONSE_1_ACE]: {
    explanationId: "blackwood.response1Ace",
    meaningId: BLACKWOOD_MEANING_IDS.RESPONSE_1_ACE,
    templateKey: "blackwood.response1Ace.semantic",
    displayText: "5♦ shows 1 ace",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BLACKWOOD_MEANING_IDS.RESPONSE_2_ACES]: {
    explanationId: "blackwood.response2Aces",
    meaningId: BLACKWOOD_MEANING_IDS.RESPONSE_2_ACES,
    templateKey: "blackwood.response2Aces.semantic",
    displayText: "5♥ shows 2 aces",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BLACKWOOD_MEANING_IDS.RESPONSE_3_ACES]: {
    explanationId: "blackwood.response3Aces",
    meaningId: BLACKWOOD_MEANING_IDS.RESPONSE_3_ACES,
    templateKey: "blackwood.response3Aces.semantic",
    displayText: "5♠ shows 3 aces",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BLACKWOOD_MEANING_IDS.ASK_KINGS]: {
    explanationId: "blackwood.askKings",
    meaningId: BLACKWOOD_MEANING_IDS.ASK_KINGS,
    templateKey: "blackwood.askKings.semantic",
    displayText: "5NT asks for kings (guarantees all aces are held)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BLACKWOOD_MEANING_IDS.SIGNOFF_SMALL_SLAM]: {
    explanationId: "blackwood.signoffSmallSlam",
    meaningId: BLACKWOOD_MEANING_IDS.SIGNOFF_SMALL_SLAM,
    templateKey: "blackwood.signoffSmallSlam.semantic",
    displayText: "Sign off at 6NT — small slam",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BLACKWOOD_MEANING_IDS.SIGNOFF_GRAND_SLAM]: {
    explanationId: "blackwood.signoffGrandSlam",
    meaningId: BLACKWOOD_MEANING_IDS.SIGNOFF_GRAND_SLAM,
    templateKey: "blackwood.signoffGrandSlam.semantic",
    displayText: "Bid 7NT — grand slam with all aces and kings",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BLACKWOOD_MEANING_IDS.SIGNOFF_5_LEVEL]: {
    explanationId: "blackwood.signoff5Level",
    meaningId: BLACKWOOD_MEANING_IDS.SIGNOFF_5_LEVEL,
    templateKey: "blackwood.signoff5Level.semantic",
    displayText: "Stop at 5-level — partnership is missing too many aces for slam",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BLACKWOOD_MEANING_IDS.KING_RESPONSE_0]: {
    explanationId: "blackwood.kingResponse0",
    meaningId: BLACKWOOD_MEANING_IDS.KING_RESPONSE_0,
    templateKey: "blackwood.kingResponse0.semantic",
    displayText: "6♣ shows 0 kings",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BLACKWOOD_MEANING_IDS.KING_RESPONSE_1]: {
    explanationId: "blackwood.kingResponse1",
    meaningId: BLACKWOOD_MEANING_IDS.KING_RESPONSE_1,
    templateKey: "blackwood.kingResponse1.semantic",
    displayText: "6♦ shows 1 king",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BLACKWOOD_MEANING_IDS.KING_RESPONSE_2]: {
    explanationId: "blackwood.kingResponse2",
    meaningId: BLACKWOOD_MEANING_IDS.KING_RESPONSE_2,
    templateKey: "blackwood.kingResponse2.semantic",
    displayText: "6♥ shows 2 kings",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BLACKWOOD_MEANING_IDS.KING_RESPONSE_3]: {
    explanationId: "blackwood.kingResponse3",
    meaningId: BLACKWOOD_MEANING_IDS.KING_RESPONSE_3,
    templateKey: "blackwood.kingResponse3.semantic",
    displayText: "6♠ shows 3 kings",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
};

// ─── Composed export ────────────────────────────────────────

export const BLACKWOOD_EXPLANATION_ENTRIES: readonly ExplanationEntry[] = [
  ...Object.values(FACT_EXPLANATIONS),
  ...Object.values(MEANING_EXPLANATIONS),
];
