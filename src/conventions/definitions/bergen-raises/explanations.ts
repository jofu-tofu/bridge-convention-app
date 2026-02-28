import type { ConventionExplanations } from "../../core/rule-tree";

export const bergenExplanations: ConventionExplanations = {
  convention: {
    purpose:
      "Differentiate major-suit raises by strength using coded bids, giving opener precise information about responder's hand",
    whenToUse:
      "Partner opens 1 of a major, the opponent passes, and you have exactly 4-card support",
    whenNotToUse: [
      "After a minor opening (1C or 1D) -- Bergen only applies to major openings",
      "With 5+ card support -- use a standard raise instead",
      "As a passed hand -- Bergen raises are OFF after you have previously passed",
      "After opponent interference (overcall or double) -- use competitive bidding instead",
    ],
    tradeoff:
      "You give up the natural meaning of 3C and 3D over a major opening. These bids can never be used to show a long minor suit as a response to 1M.",
    principle:
      "The more precisely responder describes their strength, the better opener can judge whether to try for game. Three distinct strength ranges (0-6, 7-10, 10-12) let opener make informed decisions.",
    roles:
      "Responder classifies their hand strength with the coded bid. Opener becomes captain and decides whether to pass, try for game, or bid game directly.",
  },

  decisions: {
    "splinter-hcp": {
      whyThisMatters:
        "A 12+ HCP hand with a shortage (singleton or void) is too strong for a limit raise and has distributional value. The splinter alerts partner to slam potential.",
      commonMistake:
        "Bidding a splinter with a balanced hand. You need a singleton or void -- the shortage is what makes the hand worth more than its HCP suggest.",
      denialImplication:
        "Without a shortage, a 13+ HCP hand goes directly to 4M (game raise).",
    },
    "game-raise-hcp": {
      whyThisMatters:
        "With 13+ HCP and support but no shortage, the hand is strong enough for game but lacks the distributional value to explore slam via splinter.",
    },
    "limit-raise-hcp": {
      whyThisMatters:
        "The 10-12 HCP range is invitational -- enough that game is possible if opener has extras, but not enough to bid game unilaterally.",
      commonMistake:
        "Confusing the 3D limit raise with a natural diamond bid. In Bergen, 3D shows 10-12 HCP with major support, not diamonds.",
      denialImplication:
        "If responder doesn't bid 3D, opener knows they don't have exactly 10-12 HCP with support.",
    },
    "constructive-hcp": {
      whyThisMatters:
        "The 7-10 HCP range is competitive but not invitational. It tells opener that game is only possible if opener has 17+ HCP.",
      commonMistake:
        "Confusing the 3C constructive raise with a natural club bid. In Bergen, 3C shows 7-10 HCP with major support.",
    },
    "preemptive-hcp": {
      whyThisMatters:
        "With 0-6 HCP, the raise to 3M is purely competitive -- it makes it harder for opponents to enter the auction while you have the safety of a known trump fit.",
    },
    "rebid-game-17+": {
      whyThisMatters:
        "Opener's 17+ HCP combined with responder's 7-10 HCP gives at least 24 HCP combined, enough for game.",
    },
    "rebid-try-14-16": {
      whyThisMatters:
        "With 14-16 HCP, game depends on whether responder is at the top (9-10) or bottom (7-8) of the constructive range. A help-suit game try asks responder to evaluate.",
      commonMistake:
        "Making a game try with less than 14 HCP. With only 13, even responder's maximum (10) only gives 23 combined -- usually not enough.",
    },
    "rebid-game-15+": {
      whyThisMatters:
        "Opener's 15+ HCP combined with responder's 10-12 HCP gives at least 25 HCP combined, enough for game.",
    },
    "rebid-game-18+": {
      whyThisMatters:
        "Responder's preemptive raise shows only 0-6 HCP. Opener needs 18+ to have a reasonable chance at game even opposite a near-yarborough.",
    },
    "try-accept-9-10": {
      whyThisMatters:
        "At the top of the constructive range (9-10), combined with opener's 14-16 for the game try, you have 23-26 HCP -- often enough for game.",
      denialImplication:
        "With 7-8 HCP, the combined total is only 21-24, making game unlikely. Sign off at 3M.",
    },
  },

  bids: {
    "bergen-splinter": {
      whyThisBid:
        "The splinter bid in the other major signals both strong support (12+ HCP) and a shortage somewhere. This helps opener evaluate slam potential -- if opener's values are not wasted in responder's short suit, slam may be possible.",
      partnerExpects:
        "Opener will relay (3NT or 3S) to ask which suit has the shortage, then evaluate whether to try for slam.",
      isArtificial: true,
      forcingType: "forcing",
    },
    "bergen-game-raise": {
      whyThisBid:
        "With 13+ HCP and support but no shortage, bidding game directly is the most descriptive action.",
      partnerExpects: "Opener will pass -- game has been reached.",
      forcingType: "signoff",
    },
    "bergen-limit-raise": {
      whyThisBid:
        "3D is a coded bid showing 10-12 HCP with exactly 4-card major support. It gives opener the information to decide between passing and bidding game.",
      partnerExpects:
        "Opener will bid game (4M) with 15+ HCP or sign off in 3M with less.",
      isArtificial: true,
      forcingType: "invitational",
    },
    "bergen-constructive-raise": {
      whyThisBid:
        "3C is a coded bid showing 7-10 HCP with exactly 4-card major support. It tells opener the hand has some values but is not invitational.",
      partnerExpects:
        "Opener will bid game (4M) with 17+, make a help-suit game try with 14-16, or pass with less.",
      isArtificial: true,
      forcingType: "invitational",
    },
    "bergen-preemptive-raise": {
      whyThisBid:
        "Raising directly to 3M with weak hands (0-6 HCP) is preemptive -- it takes away bidding space from opponents while the known trump fit provides safety.",
      partnerExpects:
        "Opener will pass with most hands, or bid 4M with 18+ HCP.",
      forcingType: "signoff",
    },
    "bergen-splinter-relay": {
      whyThisBid:
        "The relay asks responder to identify their shortage suit. Knowing where the shortage is helps opener evaluate whether the hands fit well for slam.",
      partnerExpects:
        "Responder will bid the step corresponding to their short suit.",
      isArtificial: true,
      forcingType: "forcing",
    },
    "bergen-splinter-disclose": {
      whyThisBid:
        "Step responses disclose the exact shortage suit so opener can evaluate fit. After 1H: 4C=clubs, 4D=diamonds, 4H=spades. After 1S: 3NT=clubs, 4C=diamonds, 4D=hearts.",
      partnerExpects:
        "Opener evaluates whether their high cards are wasted in the short suit and decides on game or slam.",
      isArtificial: true,
      forcingType: "forcing",
    },
    "bergen-rebid-try-after-constructive": {
      whyThisBid:
        "A help-suit game try bids the suit where opener needs help (their weakest side suit). Responder evaluates their holding in that suit to decide.",
      partnerExpects:
        "Responder will bid game (4M) with 9-10 HCP or good help in the asked suit, or sign off in 3M with 7-8 HCP.",
      forcingType: "invitational",
    },
    "bergen-try-accept": {
      whyThisBid:
        "At the top of the constructive range, accepting the game try is warranted. The combined values should be enough for game.",
      forcingType: "signoff",
    },
    "bergen-try-reject": {
      whyThisBid:
        "At the bottom of the constructive range, the combined values are unlikely to produce game. Signing off at 3M is the safer action.",
      forcingType: "signoff",
    },
  },

  conditions: {
    "hcp-min":
      "In Bergen, the HCP threshold determines which coded response to use. Each range signals a different strength level to opener.",
    "hcp-range":
      "Bergen uses precise HCP ranges to differentiate raises: 0-6 preemptive, 7-10 constructive, 10-12 limit, 12+ splinter/game.",
    "major-support":
      "Bergen requires exactly 4-card support in opener's major. With 5+ cards, use a standard raise instead.",
    "has-shortage":
      "A singleton or void makes the hand worth more than raw HCP suggest. Splinter bids alert partner to this distributional value.",
    "not-passed-hand":
      "Bergen raises are OFF by a passed hand. If you previously passed, your hand is limited and Bergen codes are not used.",
    "auction":
      "Bergen responses depend on the auction round. The initial coded bid is round 0; opener's rebid and responder's continuation follow in subsequent rounds.",
  },
};
