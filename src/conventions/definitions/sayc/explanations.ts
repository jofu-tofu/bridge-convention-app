import type { ConventionExplanations } from "../../core/tree/rule-tree";

export const saycExplanations: ConventionExplanations = {
  convention: {
    purpose: "Provide a complete bidding framework covering openings, responses, rebids, and competitive actions",
    whenToUse:
      "As the default bidding system for all auction positions — opener, responder, rebidder, and competitive bidder",
    whenNotToUse: [
      "When a specialized convention (Stayman, Bergen Raises, Weak Twos) applies — those override SAYC for their specific sequences",
      "After artificial sequences that have their own follow-up structure",
      "When partnership agreements specify a different system",
    ],
    tradeoff: "Breadth over depth — covers all positions but lacks the precision of specialized conventions for specific sequences",
    principle:
      "Natural bidding: bid what you have. Longest suit first, support partner when possible, bid notrump with balanced hands.",
    roles:
      "Opener describes strength and shape. Responder evaluates combined assets. Rebidder refines the picture.",
  },

  decisions: {
    "hcp-22+": {
      whyThisMatters:
        "Hands with 22+ HCP are too strong for a 1-level opening. 2C is artificial and forcing, ensuring partner responds.",
      commonMistake:
        "Opening 1-level with 22+ HCP — partner may pass and you miss a slam.",
    },
    "hcp-20-21-balanced": {
      whyThisMatters:
        "A balanced 20-21 HCP hand is too strong for 1NT (15-17) but not strong enough for 2C. 2NT precisely describes this range.",
    },
    "hcp-15-17-bal-no5M": {
      whyThisMatters:
        "1NT shows a balanced hand with 15-17 HCP and no 5-card major. This narrow range helps partner make accurate game decisions.",
      commonMistake:
        "Opening 1NT with a 5-card major — bid the major first to avoid missing a 5-3 fit.",
    },
    "preempt-7spades": {
      whyThisMatters:
        "A 7-card suit with 5-11 HCP is ideal for a 3-level preempt, consuming bidding space from opponents.",
    },
    "weak-6hearts": {
      whyThisMatters:
        "A 6-card suit with 5-11 HCP qualifies for a weak two opening, describing your hand in one bid.",
    },
    "12+-longer-spades": {
      whyThisMatters:
        "With 12+ HCP and 5+ spades as the longest suit, open 1S. Bid the longest suit first so partner can evaluate fit.",
    },
    "12+-4diamonds": {
      whyThisMatters:
        "Without a 5-card major, open your longest minor. 4+ diamonds takes priority over 3-card club support.",
    },
    "transfer-5+hearts": {
      whyThisMatters:
        "Jacoby transfers let the strong NT hand become declarer, protecting tenaces. Bid 2D to show 5+ hearts.",
    },
    "8+-with-4M": {
      whyThisMatters:
        "With 8+ HCP and a 4-card major, Stayman (2C) searches for a 4-4 major fit with opener.",
    },
    "game-raise-13+": {
      whyThisMatters:
        "With 13+ HCP and 4+ card support for partner's major, you have enough for game. Raise directly to the 4-level.",
    },
    "respond-2c-over-major": {
      whyThisMatters:
        "A new suit at the 2-level shows 10+ HCP and is forcing for one round. This keeps the bidding alive to find the best contract.",
    },
    "rebid-raise-partner": {
      whyThisMatters:
        "When partner responds in a major and you have 3+ card support, raising confirms the fit and sets the trump suit.",
    },
    "rebid-4m-after-raise": {
      whyThisMatters:
        "With 19+ HCP after partner raises your major, you have enough combined strength for game. Jump to 4-level.",
    },
    "1nt-overcall": {
      whyThisMatters:
        "A 1NT overcall shows 15-18 HCP and a balanced hand with stoppers, mirroring the 1NT opening in competitive auctions.",
    },
    "overcall-1level": {
      whyThisMatters:
        "A 1-level overcall shows 8-16 HCP with a good 5+ card suit. It competes for the contract and suggests a lead.",
    },
  },

  bids: {
    "sayc-open-1nt": {
      whyThisBid:
        "Shows a balanced hand with 15-17 HCP and no 5-card major. The narrow range gives partner maximum information.",
      partnerExpects:
        "Responder uses Stayman (2C), Jacoby transfers (2D/2H), or raises in NT based on combined strength.",
    },
    "sayc-open-2c": {
      whyThisBid:
        "Artificial and forcing — shows 22+ HCP regardless of shape. Partner must respond, even with zero points.",
      partnerExpects:
        "Responder bids 2D (waiting/negative) with fewer than 8 HCP, or a positive response showing a good suit.",
      isArtificial: true,
      forcingType: "forcing",
    },
    "sayc-open-2nt": {
      whyThisBid:
        "Shows a balanced hand with 20-21 HCP. Too strong for 1NT, not strong enough for 2C.",
      partnerExpects:
        "Responder uses Stayman (3C), transfers (3D/3H), raises NT, or passes with a very weak hand.",
    },
    "sayc-open-1s": {
      whyThisBid:
        "Shows 12+ HCP with 5+ spades (longer than or equal to hearts). Bid the longest suit first.",
      partnerExpects:
        "Responder raises with support, bids a new suit with 6+ HCP, or bids NT with a balanced hand.",
    },
    "sayc-open-1h": {
      whyThisBid:
        "Shows 12+ HCP with 5+ hearts. Opens in the longest major to find a major suit fit.",
      partnerExpects:
        "Responder raises with 3+ support, bids 1S with 4+ spades, or bids NT.",
    },
    "sayc-open-1d": {
      whyThisBid:
        "Shows 12+ HCP with 4+ diamonds and no 5-card major. Opens the longer minor.",
      partnerExpects:
        "Responder bids a 4-card major at the 1-level, raises diamonds, or bids NT.",
    },
    "sayc-open-1c": {
      whyThisBid:
        "Shows 12+ HCP with 3+ clubs and no 5-card major or 4+ diamonds. The catchall minor opening.",
      partnerExpects:
        "Responder bids a 4-card major at the 1-level, or bids NT with a balanced hand.",
    },
    "sayc-respond-1nt-stayman": {
      whyThisBid:
        "Artificial 2C asks opener for a 4-card major. Requires 8+ HCP and at least one 4-card major.",
      isArtificial: true,
      forcingType: "forcing",
    },
    "sayc-respond-1nt-transfer-hearts": {
      whyThisBid:
        "2D is a Jacoby transfer showing 5+ hearts. Opener must bid 2H, making the strong hand declarer.",
      isArtificial: true,
      forcingType: "forcing",
    },
    "sayc-respond-1nt-transfer-spades": {
      whyThisBid:
        "2H is a Jacoby transfer showing 5+ spades. Opener must bid 2S, protecting tenaces.",
      isArtificial: true,
      forcingType: "forcing",
    },
    "sayc-respond-raise-major-over-h": {
      whyThisBid:
        "A simple raise shows 6-10 HCP with 3+ card support. Sets the trump suit at a low level.",
      partnerExpects:
        "Opener passes with a minimum or tries for game with extra values.",
    },
    "sayc-respond-game-raise-major-over-h": {
      whyThisBid:
        "With 13+ HCP and 4+ card support, raise directly to game. Combined strength is enough for 10 tricks.",
      forcingType: "signoff",
    },
    "sayc-respond-jump-raise-major-over-h": {
      whyThisBid:
        "Shows 10-12 HCP with 4+ card support — invitational to game. Opener decides based on their strength.",
      forcingType: "invitational",
    },
    "sayc-respond-2c-2d-waiting": {
      whyThisBid:
        "2D is an artificial waiting bid after partner's 2C opening. Shows fewer than 8 HCP or no clear positive response.",
      isArtificial: true,
      forcingType: "forcing",
    },
    "sayc-opener-accept-transfer": {
      whyThisBid:
        "Completes the Jacoby transfer by bidding the indicated major. This is mandatory — opener must accept.",
      forcingType: "forcing",
    },
    "sayc-1nt-overcall": {
      whyThisBid:
        "Shows a balanced hand with 15-18 HCP, similar to a 1NT opening but in the competitive position.",
      partnerExpects:
        "Advancer can use Stayman, transfers, or raise in NT just as after a 1NT opening.",
    },
    "sayc-overcall-1level": {
      whyThisBid:
        "Shows 8-16 HCP with a good 5+ card suit that outranks the opponent's bid. Competes and suggests a lead.",
    },
    "sayc-overcall-2level": {
      whyThisBid:
        "Shows 10-16 HCP with a good 5+ card suit. Requires more strength than a 1-level overcall due to the higher commitment.",
    },
    "sayc-rebid-raise-partner-major": {
      whyThisBid:
        "Confirms a major suit fit by raising partner's response. Shows 12-16 HCP with 3+ card support.",
      partnerExpects:
        "Responder can pass, invite game, or bid game based on their remaining strength.",
    },
    "sayc-rebid-own-suit": {
      whyThisBid:
        "Rebids your opening suit showing 6+ cards. Describes extra length without extra strength.",
    },
    "sayc-rebid-4m-after-raise": {
      whyThisBid:
        "With 19+ HCP after partner raises, jump to game in the agreed major.",
      forcingType: "signoff",
    },
    "sayc-rebid-3m-invite": {
      whyThisBid:
        "With 17-18 HCP after partner raises, invite game. Partner accepts with a maximum raise.",
      forcingType: "invitational",
    },
  },

  conditions: {
    "hcp-min":
      "Minimum HCP thresholds ensure your side has enough combined strength for the level you are bidding.",
    "hcp-range":
      "HCP ranges narrow your hand description so partner can make accurate decisions about game and slam.",
    "suit-min":
      "Minimum suit length guarantees a playable trump suit when you bid or support a suit.",
    "is-balanced":
      "A balanced hand (no void, no singleton, at most one doubleton) is suitable for notrump contracts.",
    "major-support":
      "Supporting partner's major requires minimum trump length — 3 cards for a simple raise, 4 for a jump raise.",
    "auction-matches":
      "SAYC actions depend on what has happened in the auction — opener, responder, and rebidder all have different trees.",
  },
};
