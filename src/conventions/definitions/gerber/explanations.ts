import type { ConventionExplanations } from "../../core/rule-tree";

export const gerberExplanations: ConventionExplanations = {
  convention: {
    purpose:
      "Ask partner exactly how many aces (and then kings) they hold, to decide whether to bid slam",
    whenToUse:
      "Partner opens 1NT or 2NT, you have 16+ HCP, no void, and slam interest",
    whenNotToUse: [
      "You have a void — ace-asking conventions double-count voids and aces",
      "Partner opened a suit, not notrump — use Blackwood (4NT) instead",
      "You lack the strength for slam exploration (fewer than 16 HCP)",
    ],
    tradeoff:
      "4C is reserved as an artificial ask — you cannot use it as a natural club bid after a NT opening",
    principle:
      "Slam contracts require controlling all four suits. Counting aces and kings tells you whether the opponents can cash two quick tricks against your slam.",
    roles:
      "Responder is captain (asks the questions). Opener simply reports ace/king count via step responses.",
  },

  decisions: {
    "after-nt-opening": {
      whyThisMatters:
        "Gerber only applies after a notrump opening. After suit openings, 4C would be a natural bid or a splinter — use Blackwood (4NT) for ace-asking instead.",
      denialImplication:
        "If the auction did not start with 1NT or 2NT, this hand is in a different auction context (ace/king response, signoff, or not a Gerber sequence).",
    },
    "hcp-and-no-void": {
      whyThisMatters:
        "You need enough combined strength for slam (33+ HCP for 6NT). With opener's 15-17, you need 16+ to explore. Voids make ace-asking unreliable because a void and an ace both provide first-round control — you cannot distinguish them.",
      commonMistake:
        "Using Gerber with a void, then miscounting controls. If you have a void, consider a cue-bidding sequence instead.",
    },
    "ace-3": {
      whyThisMatters:
        "The number of aces determines the step response. Checking from highest count (3) down ensures each ace count maps to exactly one response bid.",
    },
    "ace-2": {
      whyThisMatters:
        "Two aces yields a 4S response (second step). Distinguishing 2 from 1 or 0 is critical for slam-level decisions.",
    },
    "ace-1": {
      whyThisMatters:
        "One ace yields a 4H response (first step above 4D). If you do not have exactly 1 ace, you fall through to the 0-or-4 response.",
      denialImplication:
        "Reaching the NO branch means 0 or 4 aces — partner disambiguates using their own ace count.",
    },
    "king-3": {
      whyThisMatters:
        "King responses use the same step structure as ace responses but at the 5-level. Three kings yields 5NT.",
    },
    "king-ask-check": {
      whyThisMatters:
        "Only ask for kings if the partnership holds 3+ aces combined. With fewer aces, slam is unlikely and asking for kings would push the auction dangerously high.",
      commonMistake:
        "Asking for kings with only 2 total aces — you are too high for slam and should sign off instead.",
    },
    "signoff-check": {
      whyThisMatters:
        "After receiving the ace or king response, the asking hand must place the final contract. The signoff level depends on how many aces and kings are held between both hands.",
    },
  },

  bids: {
    "gerber-ask": {
      whyThisBid:
        "4C is an artificial ask that says nothing about clubs. It asks opener: how many aces do you have?",
      partnerExpects:
        "Opener must respond with a step bid: 4D (0 or 4 aces), 4H (1), 4S (2), or 4NT (3).",
      isArtificial: true,
      forcingType: "forcing",
      commonMistake:
        "Confusing Gerber (4C after NT) with Blackwood (4NT after suit). After NT openings, 4NT is a natural quantitative invite — use 4C for ace-asking.",
    },
    "gerber-response-three": {
      whyThisBid:
        "4NT is the highest step response, showing maximum ace count (3). Partner now decides whether to ask for kings or sign off.",
      forcingType: "forcing",
    },
    "gerber-response-two": {
      whyThisBid:
        "4S is the second step, showing exactly 2 aces. A solid holding for slam exploration.",
      forcingType: "forcing",
    },
    "gerber-response-one": {
      whyThisBid:
        "4H is the first step above 4D, showing exactly 1 ace. Slam is possible but partner needs to evaluate carefully.",
      forcingType: "forcing",
    },
    "gerber-response-zero-four": {
      whyThisBid:
        "4D is the cheapest step, showing 0 or 4 aces. Partner disambiguates using their own ace count — if they hold all 4, opener has 0, and vice versa.",
      forcingType: "forcing",
      commonMistake:
        "Panicking at a 4D response thinking partner has 0 aces. Check your own ace count first — if you have 0, partner actually has all 4.",
    },
    "gerber-king-ask": {
      whyThisBid:
        "5C asks for kings using the same step structure as the ace ask. Only bid this with 3+ combined aces — otherwise sign off.",
      partnerExpects:
        "Opener responds: 5D (0 or 4 kings), 5H (1), 5S (2), or 5NT (3).",
      isArtificial: true,
      forcingType: "forcing",
    },
    "gerber-king-response-three": {
      whyThisBid:
        "5NT shows 3 kings. With 3+ aces and 3+ kings, grand slam (7NT) is likely.",
      forcingType: "forcing",
    },
    "gerber-king-response-two": {
      whyThisBid:
        "5S shows exactly 2 kings. Partner evaluates total controls for slam level.",
      forcingType: "forcing",
    },
    "gerber-king-response-one": {
      whyThisBid:
        "5H shows exactly 1 king. Small slam (6NT) may still be possible depending on total aces.",
      forcingType: "forcing",
    },
    "gerber-king-response-zero-four": {
      whyThisBid:
        "5D shows 0 or 4 kings. Same disambiguation logic as the ace response — check your own king count.",
      forcingType: "forcing",
    },
    "gerber-signoff": {
      whyThisBid:
        "Places the final contract based on combined ace and king count. 7NT with maximum controls, 6NT with enough for small slam, or a lower NT to stop safely.",
      forcingType: "signoff",
    },
  },

  conditions: {
    "hcp-min":
      "Combined with opener's 15-17 HCP, you need 16+ to reach the 31+ total needed to explore slam in notrump.",
    "ace-count":
      "Gerber uses step responses to show exact ace count: 4D=0/4, 4H=1, 4S=2, 4NT=3. The step structure keeps responses below the 5-level.",
    "king-count":
      "King responses mirror ace responses at the 5-level: 5D=0/4, 5H=1, 5S=2, 5NT=3.",
    "no-void":
      "With a void, ace-asking is unreliable — you cannot distinguish between a void (first-round control) and an ace. Use cue-bidding instead.",
    "auction":
      "Gerber responses depend on the auction stage — the convention unfolds over multiple bidding rounds as responder asks and opener answers.",
  },
};
