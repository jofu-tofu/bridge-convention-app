import type { ConventionExplanations } from "../../core/rule-tree";

export const staymanExplanations: ConventionExplanations = {
  convention: {
    purpose: "Find a 4-4 major suit fit after partner's 1NT opening",
    whenToUse:
      "Partner opens 1NT, you have 8+ HCP and at least one 4-card major",
    whenNotToUse: [
      "No 4-card major — use Jacoby transfers or bid NT directly",
      "Fewer than 8 HCP — pass",
      "After opponent interference over 1NT",
      "With exactly 4-3-3-3 shape — the flat distribution gains little from a trump fit; prefer bidding NT directly",
    ],
    tradeoff: "You can never play 2\u2663 as a natural contract after 1NT",
    principle:
      "A 4-4 major fit typically produces one more trick than notrump",
    roles:
      "Responder is captain (asks the question). Opener describes their hand.",
  },

  decisions: {
    "hcp-8-plus": {
      whyThisMatters:
        "Opener has 15-17 HCP. You need at least 8 to reach the 23+ combined HCP typically needed for game.",
      commonMistake:
        "Bidding Stayman with only 7 HCP — you risk getting too high without enough strength.",
    },
    "has-4-card-major": {
      whyThisMatters:
        "Stayman only helps if you have a 4-card major to find a 4-4 fit with opener. Without one, prefer transfers or NT.",
      commonMistake:
        "Bidding 2\u2663 Stayman with no 4-card major, hoping opener will bid your 5-card suit.",
    },
    "has-4-hearts": {
      whyThisMatters:
        "Opener shows hearts first because responding 2\u2665 keeps both majors in play — responder can still ask about spades.",
      denialImplication:
        "If opener bids 2\u2666 or 2\u2660 instead, they deny holding 4 hearts.",
    },
    "has-4-spades": {
      whyThisMatters:
        "After denying 4 hearts, this is opener's last chance to show a 4-card major.",
      denialImplication:
        "A 2\u2666 response denies both 4 hearts and 4 spades.",
    },
    "fit-hearts": {
      whyThisMatters:
        "When both partners have 4+ hearts, you have found your major fit and can set the trump suit.",
    },
    "fit-spades": {
      whyThisMatters:
        "When both partners have 4+ spades, you have found your major fit and can set the trump suit.",
    },
    "game-hcp-fit-h": {
      whyThisMatters:
        "With a heart fit established, 10+ HCP gives you 25+ combined — enough to bid game directly at 4\u2665.",
      commonMistake:
        "Inviting with 10 HCP when you should jump to game — the fit adds distributional value.",
    },
    "smolen-hearts": {
      whyThisMatters:
        "With 5 hearts and 4 spades after opener's 2\u2666 denial, bidding 3\u2665 (Smolen) lets the strong NT hand declare. Bidding your 5-card suit directly would make responder declarer, exposing the weaker hand.",
      commonMistake:
        "Bidding 3\u2665 naturally to show hearts — in Stayman, 3\u2665 after 2\u2666 is Smolen, showing 5 hearts and 4 spades.",
    },
    "has-5-spades-after-2h": {
      whyThisMatters:
        "After opener showed hearts but you lack heart support, 5+ spades gives you an alternative suit to show. The cross-major rebid lets opener choose between 3NT and a spade contract.",
    },
    "has-5-hearts-after-2s": {
      whyThisMatters:
        "After opener showed spades but you lack spade support, 5+ hearts gives you an alternative suit. A 3\u2665 rebid is game-forcing and lets opener choose between 3NT and hearts.",
    },
    "invite-hearts-after-denial": {
      whyThisMatters:
        "With 5 hearts and 4 spades but only invitational values (8-9 HCP), bidding 2\u2665 shows your shape without forcing to game. This is the invitational counterpart to Smolen.",
      commonMistake:
        "Bidding 2NT with 5-4 in the majors. Showing your 5-card major is more descriptive — partner can pass, raise, or bid 2NT.",
    },
    "invite-spades-after-denial": {
      whyThisMatters:
        "With 5 spades and 4 hearts but only invitational values (8-9 HCP), bidding 2\u2660 shows your shape non-forcingly. Partner can pass, raise, or bid 2NT.",
    },
    "has-6-4-majors-after-denial": {
      whyThisMatters:
        "With 6+ hearts and 4 spades after denial, you have enough shape to bid game directly. Even without a 4-4 fit, a 6-card major provides a strong trump suit.",
    },
    "has-6-4-spades-after-denial": {
      whyThisMatters:
        "With 6+ spades and 4 hearts after denial, you have enough shape to bid game directly in your long major.",
    },
  },

  bids: {
    "stayman-ask": {
      whyThisBid:
        "2\u2663 is an artificial asking bid — it says nothing about clubs. It asks opener: do you have a 4-card major?",
      partnerExpects:
        "Opener must respond 2\u2666 (no major), 2\u2665 (4+ hearts), or 2\u2660 (4+ spades, denies 4 hearts).",
      isArtificial: true,
      forcingType: "forcing",
      commonMistake:
        "Thinking 2\u2663 shows clubs. After 1NT, 2\u2663 is always Stayman, never natural.",
    },
    "stayman-response-hearts": {
      whyThisBid:
        "Shows 4+ hearts. Hearts are bid before spades to keep both majors in play.",
      partnerExpects:
        "Responder will raise hearts with a fit, bid NT without a fit, or use Smolen to show 5 of the other major.",
      forcingType: "forcing",
    },
    "stayman-response-spades": {
      whyThisBid:
        "Shows 4+ spades while denying 4 hearts (hearts would have been bid first).",
      partnerExpects:
        "Responder will raise spades with a fit or bid NT without one.",
      forcingType: "forcing",
    },
    "stayman-response-denial": {
      whyThisBid:
        "2\u2666 is artificial — it denies holding any 4-card major. It says nothing about diamonds.",
      partnerExpects:
        "Responder will bid NT (with or without game values) or use Smolen with a 5-4 major shape.",
      isArtificial: true,
      forcingType: "forcing",
      commonMistake:
        "Thinking 2\u2666 shows diamonds. It is purely a denial of 4+ hearts and 4+ spades.",
    },
    "stayman-rebid-major-fit": {
      whyThisBid:
        "Raises to game in the agreed major. With 10+ HCP and a 4-4 fit, you have enough combined strength.",
      forcingType: "signoff",
    },
    "stayman-rebid-no-fit": {
      whyThisBid:
        "Without a major fit, 3NT is the best game contract. Your combined 25+ HCP should produce 9 tricks in notrump.",
      forcingType: "signoff",
    },
    "stayman-rebid-smolen-hearts": {
      whyThisBid:
        "3\u2665 Smolen shows 5 hearts and 4 spades. By bidding the shorter major, you transfer the contract to the NT opener as declarer, protecting their tenaces.",
      partnerExpects:
        "Opener bids 4\u2665 with 3+ hearts (the known 5-3 fit) or 3NT without heart support.",
      isArtificial: true,
      forcingType: "game-forcing",
      commonMistake:
        "Bidding 3\u2665 to show hearts naturally. After a 2\u2666 denial, 3-level major bids are Smolen — showing the OTHER major's length.",
    },
    "stayman-rebid-smolen-spades": {
      whyThisBid:
        "3\u2660 Smolen shows 5 spades and 4 hearts. Bidding the shorter major transfers the contract to opener.",
      partnerExpects:
        "Opener bids 4\u2660 with 3+ spades (the known 5-3 fit) or 3NT without spade support.",
      isArtificial: true,
      forcingType: "game-forcing",
    },
    "stayman-rebid-cross-major-gf": {
      whyThisBid:
        "Shows 5+ cards in the other major with game-forcing values. Partner can support your major or fall back to 3NT.",
      partnerExpects:
        "Opener raises with 3+ support or bids 3NT without a fit.",
      forcingType: "game-forcing",
    },
    "stayman-rebid-cross-major-invite": {
      whyThisBid:
        "Shows 5+ spades with invitational values after opener showed hearts. Non-forcing — partner can pass, raise, or bid 2NT.",
      partnerExpects:
        "Opener raises spades with 3+ support, bids 2NT with a minimum, or bids 3NT with a maximum.",
      forcingType: "invitational",
    },
    "stayman-rebid-minor-gf": {
      whyThisBid:
        "Shows 5+ cards in a minor suit with game-forcing values. Typically used with 6+ card minor and no major fit.",
      partnerExpects:
        "Opener can support the minor, bid 3NT, or explore further.",
      forcingType: "game-forcing",
    },
    "stayman-rebid-invite-major": {
      whyThisBid:
        "Shows 5-4 in the majors with invitational values (8-9 HCP). This is the non-forcing counterpart to Smolen — same shape but insufficient values for game.",
      partnerExpects:
        "Opener can pass, raise the major, bid 2NT with a minimum, or bid 3NT with a maximum.",
      forcingType: "invitational",
    },
    "stayman-rebid-major-game-64": {
      whyThisBid:
        "With 6-4 in the majors and game values after opener's denial, bids game directly in the 6-card major. Even without a 4-4 fit, the long suit provides a strong trump holding.",
      forcingType: "signoff",
    },
  },

  conditions: {
    "hcp-min":
      "Combined with opener's 15-17 HCP, you need 8+ to reach the 23+ total typically required for 3NT game.",
    "suit-min":
      "A 4-card major is the minimum length to find a 4-4 fit with opener.",
    "auction-matches":
      "Stayman responses depend on which round of the auction you are in — the convention unfolds over multiple bidding rounds.",
  },
};
