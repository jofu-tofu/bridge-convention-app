import type { ConventionExplanations } from "../../core/tree/rule-tree";

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

  decisions: {
    "has-6-hearts": {
      whyThisMatters:
        "Weak twos check suits in priority order (hearts, spades, diamonds). A 6-card heart suit is opened first because it consumes the most bidding space among the eligible suits.",
    },
    "has-6-spades": {
      whyThisMatters:
        "With no 6-card heart suit, a 6-card spade suit is the next candidate for a weak two opening.",
    },
    "has-6-diamonds": {
      whyThisMatters:
        "Diamonds is the last eligible suit for a weak two. Clubs is excluded because 2C is reserved for strong artificial openings.",
    },
    "game-strength-with-fit": {
      whyThisMatters:
        "With 16+ HCP and 3+ support, combined values reach game opposite a weak two (5-11 HCP). Raising directly is preferred over Ogust because you already know enough to place the contract.",
      commonMistake:
        "Asking Ogust with a game-forcing hand and fit -- you don't need more information, just bid game.",
    },
    "ogust-ask": {
      whyThisMatters:
        "With 16+ HCP but no fit, you need more information about opener's hand to choose the right game. 2NT (Ogust) asks opener to classify their strength and suit quality.",
      denialImplication:
        "Not asking Ogust with 16+ HCP means you either have a fit (and raised) or have fewer than 16 HCP.",
    },
    "invite-with-fit": {
      whyThisMatters:
        "With 14-15 HCP and 3+ support, you are close to game values but not certain. A simple raise invites opener to bid game with a maximum.",
      commonMistake:
        "Passing with 14-15 HCP and a fit -- you have enough to invite even opposite a weak hand.",
    },
    "solid-suit": {
      whyThisMatters:
        "A solid suit (AKQ or better) is the strongest possible holding. Responding 3NT tells partner the suit will run without losers.",
    },
    "min-hcp": {
      whyThisMatters:
        "The first Ogust split is by HCP range: minimum (5-8) vs maximum (9-11). This tells responder whether combined values reach game territory.",
    },
    "min-good-suit": {
      whyThisMatters:
        "Within the minimum range, suit quality (2+ top honors vs fewer) helps responder judge trick-taking potential and whether to compete further.",
    },
    "max-good-suit": {
      whyThisMatters:
        "Within the maximum range, suit quality determines whether the hand is suitable for game or slam exploration.",
    },
  },

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
