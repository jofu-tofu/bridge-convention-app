import type { ConventionExplanations } from "../../core/rule-tree";

export const weakTwosExplanations: ConventionExplanations = {
  convention: {
    purpose: "Preempt opponents by opening at the 2-level with a long suit and weak hand",
    whenToUse:
      "You have 5-11 HCP and a 6-card suit in hearts, spades, or diamonds",
    whenNotToUse: [
      "With 12+ HCP -- your hand is too strong for a weak two",
      "With only a 5-card suit -- you need 6+ for a weak two",
      "With a 6-card club suit -- 2C is reserved for strong openings",
    ],
    tradeoff: "You give up the ability to open at the 1-level, but you consume bidding space from opponents",
    principle:
      "Preemptive bids trade accuracy for obstruction -- the less you have, the more you want to make opponents guess",
    roles:
      "Opener describes their hand (weak, long suit). Responder is captain and decides whether to pass, invite, or ask via Ogust.",
  },

  decisions: {},

  bids: {
    "weak-two-opening": {
      whyThisBid:
        "A weak two bid shows a 6-card suit with 5-11 HCP. It takes bidding space from opponents while being relatively safe due to the long suit.",
      partnerExpects:
        "Partner will evaluate whether to pass, raise, or ask about hand quality with 2NT (Ogust).",
      forcingType: "signoff",
    },
    "weak-two-ogust-ask": {
      whyThisBid:
        "2NT asks opener to classify their hand by HCP range (min vs max) and suit quality (good vs bad). This helps responder decide the final contract.",
      partnerExpects:
        "Opener must respond: 3C (min/bad), 3D (min/good), 3H (max/bad), 3S (max/good), or 3NT (solid AKQ suit).",
      isArtificial: true,
      forcingType: "forcing",
    },
  },

  conditions: {},
};
