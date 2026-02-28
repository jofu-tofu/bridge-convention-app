import type { ConventionExplanations } from "../../core/rule-tree";

export const landyExplanations: ConventionExplanations = {
  convention: {
    purpose:
      "Compete for a partscore or game when opponents open 1NT, using 2\u2663 to show both major suits",
    whenToUse:
      "Opponent opens 1NT, you have 10+ HCP and at least 5-4 in the majors",
    whenNotToUse: [
      "Fewer than 10 HCP — pass or consider a different defensive convention",
      "Only one major suit — Landy specifically shows both majors",
      "4-4 in the majors — you need at least 5-4 shape",
    ],
    tradeoff:
      "You give up the natural 2\u2663 overcall showing clubs over 1NT",
    principle:
      "Competing with both majors is safer than passing — major-suit fits play well even at the 2-level",
    roles:
      "Overcaller announces major-suit shape. Advancer chooses the best major or uses 2NT to ask for more detail.",
  },

  decisions: {
    "after-1nt": {
      whyThisMatters:
        "Landy only applies after an opponent opens 1NT. The 2\u2663 bid is conventional only in this specific context.",
    },
    "both-majors": {
      whyThisMatters:
        "Landy requires at least 5-4 in the majors and 10+ HCP. Without both, a 2\u2663 bid would mislead partner about your shape.",
      commonMistake:
        "Bidding 2\u2663 Landy with only 4-4 in the majors — you need at least one 5-card major.",
    },
    "has-12-plus": {
      whyThisMatters:
        "With 12+ HCP opposite a partner who showed 10+, you may have game values. The 2NT inquiry asks partner to describe their exact shape and strength.",
      denialImplication:
        "Without 12+ HCP, advancer simply picks their best major at the 2-level or passes with clubs.",
    },
    "5-5-majors": {
      whyThisMatters:
        "With equal-length majors (5-5), overcaller uses a different set of rebids than with unequal majors (5-4). Partner needs to know whether the majors are equal.",
      denialImplication:
        "If overcaller bids 3\u2663 or 3\u2666 instead of 3\u2665/3\u2660/3NT, they have unequal majors (5-4 or 4-5).",
    },
    "max-12+": {
      whyThisMatters:
        "With 5-5 majors, three strength levels are distinguished: 3\u2665 (minimum 6-10), 3\u2660 (medium 10-12), 3NT (maximum 12+). This helps advancer judge the combined strength.",
    },
    "med-10+": {
      whyThisMatters:
        "Separates medium hands (10-12) from minimum hands (6-10) so advancer can decide between partscore and game.",
    },
    "max-12+-54": {
      whyThisMatters:
        "With unequal majors, overcaller bids 3\u2666 (maximum 12+) or 3\u2663 (medium/minimum). Advancer then picks the correct major.",
    },
    "has-5-clubs": {
      whyThisMatters:
        "With 5+ clubs, passing 2\u2663 is the best contract — overcaller's bid happens to name your real suit.",
      commonMistake:
        "Pulling 2\u2663 to a major with only 3-card support when you have a natural club fit.",
    },
    "has-4-hearts": {
      whyThisMatters:
        "With 4+ hearts, you know overcaller has at least 4 hearts too (they showed 5-4+ majors). A heart fit is guaranteed.",
    },
    "has-4-spades": {
      whyThisMatters:
        "With 4+ spades, you know overcaller has at least 4 spades. A spade fit is guaranteed.",
      denialImplication:
        "Without 4 of either major, advancer bids 2\u2666 to let overcaller pick their longer major.",
    },
  },

  bids: {
    "landy-2c": {
      whyThisBid:
        "2\u2663 is artificial — it shows both major suits (5-4+), not clubs. It is the Landy convention's signature bid.",
      partnerExpects:
        "Advancer picks a major (2\u2665/2\u2660), bids 2NT to inquire about shape and strength, or passes with 5+ clubs.",
      isArtificial: true,
      forcingType: "forcing",
      commonMistake:
        "Thinking 2\u2663 shows clubs. Over 1NT, 2\u2663 is always Landy when playing this convention.",
    },
    "landy-response-2nt": {
      whyThisBid:
        "2NT is an artificial inquiry asking overcaller to describe their exact major shape and strength.",
      partnerExpects:
        "Overcaller rebids to show 5-5 vs 5-4 and minimum/medium/maximum strength.",
      isArtificial: true,
      forcingType: "forcing",
    },
    "landy-response-3h": {
      whyThisBid:
        "A direct raise to 3\u2665 shows invitational values (10-12 HCP) with heart support.",
      partnerExpects:
        "Overcaller passes with minimum, bids 4\u2665 with extras.",
      forcingType: "invitational",
    },
    "landy-response-3s": {
      whyThisBid:
        "A direct raise to 3\u2660 shows invitational values (10-12 HCP) with spade support.",
      partnerExpects:
        "Overcaller passes with minimum, bids 4\u2660 with extras.",
      forcingType: "invitational",
    },
    "landy-response-pass": {
      whyThisBid:
        "Passing 2\u2663 converts overcaller's conventional bid into a natural club contract.",
      forcingType: "signoff",
    },
    "landy-response-2h": {
      whyThisBid:
        "Shows a preference for hearts. Overcaller has at least 4, so a fit exists.",
      forcingType: "signoff",
    },
    "landy-response-2s": {
      whyThisBid:
        "Shows a preference for spades. Overcaller has at least 4, so a fit exists.",
      forcingType: "signoff",
    },
    "landy-response-2d": {
      whyThisBid:
        "2\u2666 is an artificial relay asking overcaller to bid their longer major. Used when advancer has no clear major preference.",
      partnerExpects:
        "Overcaller bids their longer major suit.",
      isArtificial: true,
      forcingType: "forcing",
    },
    "landy-rebid-3nt": {
      whyThisBid:
        "Shows 5-5 majors with maximum strength (12+). Advancer can place the final contract.",
      forcingType: "signoff",
    },
    "landy-rebid-3s": {
      whyThisBid:
        "Shows 5-5 majors with medium strength (10-12). Advancer decides between partscore and game.",
      forcingType: "invitational",
    },
    "landy-rebid-3h": {
      whyThisBid:
        "Shows 5-5 majors with minimum strength (6-10). Advancer should usually pass or correct to 3\u2660.",
      forcingType: "signoff",
    },
    "landy-rebid-3d": {
      whyThisBid:
        "Shows unequal majors (5-4 or 4-5) with maximum strength (12+). Advancer picks the best major.",
      forcingType: "signoff",
    },
    "landy-rebid-3c": {
      whyThisBid:
        "Shows unequal majors (5-4 or 4-5) with medium strength. Advancer picks the best major.",
      forcingType: "signoff",
    },
  },

  conditions: {
    "hcp-min":
      "Landy overcaller needs 10+ HCP to compete safely at the 2-level against a strong 1NT opener.",
    "hcp-range":
      "Strength tiers help advancer judge the combined partnership strength for game decisions.",
    "two-suited":
      "Landy specifically shows both majors (5-4+). The 2\u2663 bid is meaningless without this shape.",
    "suit-min":
      "Suit length requirements ensure a fit exists when advancer picks a major.",
    "auction-matches":
      "Landy unfolds over multiple rounds — overcaller bids 2\u2663, advancer responds, and overcaller may rebid after a 2NT inquiry.",
  },
};
