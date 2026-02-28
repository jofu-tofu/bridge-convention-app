import type { ConventionExplanations } from "../../core/rule-tree";

export const dontExplanations: ConventionExplanations = {
  convention: {
    purpose:
      "Disrupt opponent's strong 1NT opening by showing distributional hands with one or two long suits",
    whenToUse:
      "Partner of the overcaller after RHO opens 1NT. Overcaller has 8-15 HCP with either a 6+ card suit or two suits (5-4 or better).",
    whenNotToUse: [
      "With a balanced hand — DONT requires shape, not just HCP",
      "With fewer than 8 HCP — too weak to compete at the 2-level",
      "After a weak NT (12-14) — less reason to disrupt",
      "In balancing seat — different methods apply",
    ],
    tradeoff:
      "You give up penalty doubles of 1NT. A DONT double shows a suit, not strength.",
    principle:
      "Distributional hands compete better than balanced ones. A two-suited hand often produces more tricks than its HCP suggests.",
    roles:
      "Overcaller describes shape. Advancer decides the final contract (pass, relay, or escape to a long suit).",
  },

  decisions: {
    "both-majors": {
      whyThisMatters:
        "Two-suited hands with both majors are the highest priority because they have two known major fits to explore.",
      commonMistake:
        "With 6 spades and 4 hearts, bidding 2S natural instead of 2H — 2H (both majors) gives partner a choice of suits.",
    },
    "diamonds-plus-major": {
      whyThisMatters:
        "Showing diamonds plus a major gives partner the relay option to discover which major you hold.",
    },
    "clubs-plus-higher": {
      whyThisMatters:
        "Clubs plus a higher suit covers the widest range of two-suited hands — partner relays to discover your second suit.",
    },
    "6-plus-spades": {
      whyThisMatters:
        "With 6+ spades you can bid 2S naturally, the most descriptive call. This is preferred over doubling because partner immediately knows your suit.",
      denialImplication:
        "Without 6+ spades and without a two-suiter, the only remaining option is a double to show a single long non-spade suit.",
    },
    "single-long-suit": {
      whyThisMatters:
        "The DONT double shows a single long suit (6+) that is not spades. Partner must relay with 2C to discover which suit.",
      commonMistake:
        "Doubling with a two-suited hand — if you have 5-4 or better in two suits, use the specific two-suited bid instead.",
    },
    "hearts-support": {
      whyThisMatters:
        "After partner shows both majors with 2H, 3+ hearts means you have adequate support to pass and play in hearts.",
      denialImplication:
        "Without 3+ hearts, you should bid 2S to play in spades (partner's other major) or escape to a long minor.",
    },
    "spades-support": {
      whyThisMatters:
        "After partner's natural 2S (6+ spades), 2+ spades is enough support to pass since partner has a long self-sufficient suit.",
    },
    "diamonds-support": {
      whyThisMatters:
        "After partner shows diamonds plus a major, 3+ diamonds means you can play in the known suit without needing to discover the major.",
      denialImplication:
        "Without diamond support, relay with 2H to discover partner's major.",
    },
    "clubs-support": {
      whyThisMatters:
        "After partner shows clubs plus a higher suit, 3+ clubs means you can play in the known suit.",
      denialImplication:
        "Without club support, relay with 2D to discover partner's second suit.",
    },
    "clubs-long": {
      whyThisMatters:
        "After the relay sequence 1NT-X-P-2C-P, overcaller passes if clubs IS the long suit, or bids the actual suit.",
    },
  },

  bids: {
    "dont-2h": {
      whyThisBid:
        "2H is the conventional bid showing both majors (5-4 or 4-5). Partner can pass with hearts or bid 2S with spades.",
      partnerExpects:
        "Pass with 3+ hearts, bid 2S to prefer spades, bid 2NT to ask about strength and distribution, or escape to a long minor at the 3-level.",
      isArtificial: false,
      forcingType: "signoff",
    },
    "dont-2d": {
      whyThisBid:
        "Shows diamonds plus an unspecified major. Partner must relay or pass to discover which major you hold.",
      partnerExpects:
        "Pass with 3+ diamonds, bid 2H as relay to discover the major, bid 2S with 6+ spades, or bid 2NT to ask about strength.",
      isArtificial: false,
      forcingType: "signoff",
    },
    "dont-2c": {
      whyThisBid:
        "Shows clubs plus an unspecified higher-ranking suit. Partner relays to discover the second suit.",
      partnerExpects:
        "Pass with 3+ clubs, bid 2D as relay, bid a 6+ card major directly, or bid 2NT to ask about strength.",
      isArtificial: false,
      forcingType: "signoff",
    },
    "dont-2s": {
      whyThisBid:
        "Natural bid showing 6+ spades. Unlike other DONT bids, this directly names the suit.",
      partnerExpects:
        "Pass with 2+ spades or escape to a long suit at the 3-level.",
      isArtificial: false,
      forcingType: "signoff",
    },
    "dont-double": {
      whyThisBid:
        "The DONT double is conventional — it shows a single long suit (6+, non-spades). Partner must relay with 2C.",
      partnerExpects:
        "Bid 2C as a forced relay (pass-or-correct). Overcaller will pass with clubs or bid their actual suit.",
      isArtificial: true,
      forcingType: "forcing",
      commonMistake:
        "Thinking partner is making a penalty double of 1NT. In DONT, double always shows a long suit.",
    },
    "dont-advance-pass": {
      whyThisBid:
        "Passing accepts partner's shown or implied suit. With adequate support, staying at the 2-level is the safest action.",
      forcingType: "signoff",
    },
    "dont-advance-next-step": {
      whyThisBid:
        "The relay asks overcaller to clarify their second suit (after 2C/2D) or to reveal their long suit (after double).",
      partnerExpects:
        "Overcaller bids their second suit or passes if already in the right contract.",
      isArtificial: true,
      forcingType: "forcing",
    },
    "dont-advance-long-suit": {
      whyThisBid:
        "With 6+ cards in your own suit, you bypass the relay and bid your suit directly at the 2-level.",
      forcingType: "signoff",
    },
    "dont-advance-3-level": {
      whyThisBid:
        "With 6+ cards in a suit not shown by partner, escape to the 3-level as a non-forcing natural bid.",
      forcingType: "signoff",
      commonMistake:
        "Bidding at the 3-level without 6+ cards — you need a long self-sufficient suit to compete this high.",
    },
    "dont-advance-2nt": {
      whyThisBid:
        "2NT is an artificial forcing inquiry asking overcaller to describe strength (min/max) and suit distribution.",
      partnerExpects:
        "Overcaller rebids at 3-level: lower bids show minimum, higher bids show maximum with suit identification.",
      isArtificial: true,
      forcingType: "forcing",
    },
    "dont-reveal-pass": {
      whyThisBid:
        "After the 2C relay, passing confirms clubs IS the long suit. No correction needed.",
      forcingType: "signoff",
    },
    "dont-reveal-suit": {
      whyThisBid:
        "After the 2C relay, correcting to your actual long suit completes the pass-or-correct mechanism.",
      forcingType: "signoff",
    },
    "dont-2nt-rebid": {
      whyThisBid:
        "Responds to partner's 2NT inquiry by showing strength (min/max around 11 HCP split) and suit distribution.",
      forcingType: "signoff",
    },
  },

  conditions: {
    "single-long-suit":
      "In DONT, a single long suit means 6+ cards in one non-spade suit with no second 4+ suit. With a second suit, use the specific two-suited bid instead.",
    "hcp-min":
      "DONT overcalls require 8+ HCP minimum — lighter than many conventions because distributional hands play well.",
    "auction-matches":
      "DONT responses depend on which overcall partner made — each overcall creates a different relay/pass-or-correct structure.",
  },
};
