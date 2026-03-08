import type { ConventionExplanations } from "../../core/tree/rule-tree";

export const lebensohlLiteExplanations: ConventionExplanations = {
  convention: {
    purpose:
      "Handle competitive bidding after partner opens 1NT and an opponent overcalls at the 2-level",
    whenToUse: "Partner opens 1NT, opponent overcalls 2\u2666, 2\u2665, or 2\u2660",
    whenNotToUse: [
      "Opponent passes after 1NT (no interference)",
      "Overcall is at the 3-level or higher",
      "Your side did not open 1NT",
    ],
    tradeoff:
      "Sacrifices a natural 2NT bid to gain the ability to distinguish weak signoffs from game-forcing hands",
    principle:
      "Slow shows, fast denies: going through the 2NT relay shows a stopper; bidding 3NT directly denies one",
    roles:
      "Responder decides between relay (weak signoff or slow shows stopper) and direct bids (game-forcing suits or fast-denies 3NT). Opener has a forced 3\u2663 relay completion.",
  },

  decisions: {
    "hcp-10-plus": {
      whyThisMatters:
        "The 10 HCP boundary separates game-try hands from weak signoff hands. With 10+, responder can make forcing bids; below 10, the goal is to place the contract as cheaply as possible.",
      commonMistake:
        "Bidding at the 3-level with fewer than 10 HCP, which partner reads as game-forcing",
    },
    "has-stopper-for-relay": {
      whyThisMatters:
        "With 10+ HCP and no 5-card suit, stopper presence determines the path to 3NT: relay (slow shows stopper) versus direct 3NT (fast denies stopper)",
      commonMistake:
        "Bidding 3NT directly with a stopper, violating the slow-shows convention",
    },
    "weak-has-5-clubs": {
      whyThisMatters:
        "A weak hand with 5+ clubs should relay via 2NT to reach 3\u2663, not pass and let the opponents play at the 2-level",
    },
    "game-values-with-stopper": {
      whyThisMatters:
        "After the relay, responder with game values and a stopper bids 3NT via the slow-shows path, confirming the stopper for partner",
    },
    "weak-clubs-signoff": {
      whyThisMatters:
        "After the relay, a weak hand with clubs simply passes 3\u2663 to play there",
    },
  },

  bids: {
    "lebensohl-penalty-double": {
      whyThisBid:
        "With 10+ HCP and 4+ cards in the overcalled suit, double is for penalty \u2014 you expect to defeat the contract",
      partnerExpects: "Partner passes the double to defend",
      isArtificial: false,
      forcingType: "forcing",
    },
    "lebensohl-direct-gf-spades": {
      whyThisBid:
        "A direct 3\u2660 over the overcall shows a game-forcing hand with 5+ spades",
      partnerExpects:
        "Partner should raise with support or bid 3NT with a stopper in the overcalled suit",
      isArtificial: false,
      forcingType: "game-forcing",
    },
    "lebensohl-direct-gf-hearts": {
      whyThisBid:
        "A direct 3\u2665 over the overcall shows a game-forcing hand with 5+ hearts",
      partnerExpects:
        "Partner should raise with support or bid 3NT with a stopper",
      isArtificial: false,
      forcingType: "game-forcing",
    },
    "lebensohl-relay-with-stopper": {
      whyThisBid:
        "2NT is an artificial relay to 3\u2663. With 10+ HCP and a stopper, this starts the slow-shows path toward 3NT",
      partnerExpects: "Partner must bid 3\u2663 (forced relay completion)",
      isArtificial: true,
      forcingType: "forcing",
      commonMistake:
        "Bidding 3NT directly with a stopper \u2014 that denies a stopper in Lebensohl",
    },
    "lebensohl-direct-3nt": {
      whyThisBid:
        "Bidding 3NT directly (fast denies) shows game values without a stopper in the overcalled suit",
      partnerExpects:
        "Partner should pass if they have a stopper, or pull to a suit contract if not",
      isArtificial: false,
      forcingType: "signoff",
    },
    "lebensohl-relay-accept": {
      whyThisBid:
        "Opener must bid 3\u2663 after partner's 2NT relay \u2014 this is a forced, artificial completion",
      isArtificial: true,
      forcingType: "forcing",
    },
    "lebensohl-slow-3nt": {
      whyThisBid:
        "After the relay, bidding 3NT confirms both game values and a stopper (slow shows)",
      isArtificial: false,
      forcingType: "signoff",
    },
    "lebensohl-weak-signoff": {
      whyThisBid:
        "With a weak hand and no 5-card suit to sign off in, passing is the safest option",
      isArtificial: false,
      forcingType: "signoff",
    },
  },

  conditions: {
    "hcp-min":
      "Minimum HCP threshold \u2014 10+ HCP separates game-try hands from weak signoffs",
    "suit-min":
      "Minimum suit length \u2014 5+ cards required for direct game-forcing suit bids or relay signoffs",
    "suit-quality":
      "Stopper quality in the overcalled suit \u2014 determines the relay (slow shows) versus direct 3NT (fast denies) path",
    "auction-matches":
      "Checks that the auction matches the expected Lebensohl sequence (1NT opening, 2-level overcall)",
  },
};
