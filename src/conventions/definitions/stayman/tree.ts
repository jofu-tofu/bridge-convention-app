import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import {
  bidMade,
  isResponder,
  isOpener,
  lastEntryIsPass,
  hcpMin,
  hcpRange,
  suitMin,
  anySuitMin,
  and,
} from "../../core/conditions";
import type { AuctionCondition } from "../../core/types";
import { handDecision, bid, fallback } from "../../core/rule-tree";
import type { HandNode } from "../../core/rule-tree";
import { protocol, round, semantic } from "../../core/protocol";
import type { ConventionProtocol, EstablishedContext } from "../../core/protocol";
// SUIT_ORDER indices: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs

// ─── Established context ────────────────────────────────────

interface StaymanEstablished extends EstablishedContext {
  openingLevel?: number;
  showed?: "hearts" | "spades" | "denial";
}

// ─── Hand subtrees (unchanged from slot tree) ────────────────

// Round 1: Responder asks 2C (after 1NT-P)
// Note: Bridge Bum recommends avoiding Stayman with 4-3-3-3 shape, but this is stylistic
// guidance documented in whenNotToUse, not a hard gate. Many players still bid Stayman with 4333.
const round1Ask = handDecision(
  "hcp-8-plus",
  hcpMin(8),
  handDecision(
    "has-4-card-major",
    anySuitMin(
      [
        { index: 0, name: "spades" },
        { index: 1, name: "hearts" },
      ],
      4,
    ),
    bid("stayman-ask", "Asks for a 4-card major", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
    fallback("no-major"),
  ),
  fallback("too-weak"),
);

// Round 2: Opener responds (after 1NT-P-2C-P)
const round2Response = handDecision(
  "has-4-hearts",
  suitMin(1, "hearts", 4),
  bid("stayman-response-hearts", "Shows 4+ hearts", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
  handDecision(
    "has-4-spades",
    suitMin(0, "spades", 4),
    bid("stayman-response-spades", "Shows 4+ spades but denies 4 hearts", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Spades })),
    bid("stayman-response-denial", "Denies holding a 4-card major", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds })),
  ),
);

// Round 3: Responder rebids — decomposed per opener response

// After opener showed 2H
const rebidAfter2H = handDecision(
  "fit-hearts",
  suitMin(1, "hearts", 4),
  // Fit found: game or invite based on HCP
  handDecision(
    "game-hcp-fit-h",
    hcpMin(10),
    bid("stayman-rebid-major-fit", "Raises to game in the agreed major", (): Call => ({ type: "bid", level: 4, strain: BidSuit.Hearts })),
    bid("stayman-rebid-major-fit-invite", "Invites game in the agreed major", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts })),
  ),
  // No heart fit — check for 5+ spades (cross-major)
  handDecision(
    "has-5-spades-after-2h",
    suitMin(0, "spades", 5),
    handDecision(
      "game-hcp-cross-major-h",
      hcpMin(10),
      // 3S game-forcing: 5S+4H shape, opener may have spade support
      bid("stayman-rebid-cross-major-gf", "Shows 5+ spades with game-forcing values", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Spades })),
      // 2S invitational: 5S+4H shape, non-forcing
      bid("stayman-rebid-cross-major-invite", "Shows 5+ spades, invitational", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Spades })),
    ),
    // No spade length — check for minor suit GF
    handDecision(
      "minor-gf-after-2h",
      and(hcpMin(10), suitMin(2, "diamonds", 5)),
      bid("stayman-rebid-minor-gf", "Shows 5+ diamonds, game-forcing", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
      handDecision(
        "clubs-gf-after-2h",
        and(hcpMin(10), suitMin(3, "clubs", 5)),
        bid("stayman-rebid-minor-gf", "Shows 5+ clubs, game-forcing", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
        // No special shape — NT game or invite
        handDecision(
          "game-hcp-nofit-h",
          hcpMin(10),
          bid("stayman-rebid-no-fit", "Bids game in notrump without a major fit", (): Call => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
          bid("stayman-rebid-no-fit-invite", "Invites game in notrump without a major fit", (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
        ),
      ),
    ),
  ),
);

// After opener showed 2S
const rebidAfter2S = handDecision(
  "fit-spades",
  suitMin(0, "spades", 4),
  handDecision(
    "game-hcp-fit-s",
    hcpMin(10),
    bid("stayman-rebid-major-fit", "Raises to game in the agreed major", (): Call => ({ type: "bid", level: 4, strain: BidSuit.Spades })),
    bid("stayman-rebid-major-fit-invite", "Invites game in the agreed major", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Spades })),
  ),
  // No spade fit — check for 5+ hearts (cross-major)
  handDecision(
    "has-5-hearts-after-2s",
    suitMin(1, "hearts", 5),
    handDecision(
      "game-hcp-cross-major-s",
      hcpMin(10),
      // 3H game-forcing: 5H+4S shape (opener denied hearts but may have 3)
      bid("stayman-rebid-cross-major-gf", "Shows 5+ hearts with game-forcing values", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts })),
      // No invitational cross-major after 2S — 2H would be below 2S, so not available
      // Fall through to NT
      bid("stayman-rebid-no-fit-invite", "Invites game in notrump without a major fit", (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
    ),
    // No heart length — check for minor suit GF
    handDecision(
      "minor-gf-after-2s",
      and(hcpMin(10), suitMin(2, "diamonds", 5)),
      bid("stayman-rebid-minor-gf", "Shows 5+ diamonds, game-forcing", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
      handDecision(
        "clubs-gf-after-2s",
        and(hcpMin(10), suitMin(3, "clubs", 5)),
        bid("stayman-rebid-minor-gf", "Shows 5+ clubs, game-forcing", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
        // No special shape — NT game or invite
        handDecision(
          "game-hcp-nofit-s",
          hcpMin(10),
          bid("stayman-rebid-no-fit", "Bids game in notrump without a major fit", (): Call => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
          bid("stayman-rebid-no-fit-invite", "Invites game in notrump without a major fit", (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
        ),
      ),
    ),
  ),
);

// After opener denied with 2D
const rebidAfter2D = handDecision(
  "has-6-4-majors-after-denial",
  and(hcpMin(10), suitMin(1, "hearts", 6), suitMin(0, "spades", 4)),
  // 4H signoff: 6H+4S, game values, bid game directly
  bid("stayman-rebid-major-game-64", "Bids game with 6-4 major shape", (): Call => ({ type: "bid", level: 4, strain: BidSuit.Hearts })),
  handDecision(
    "has-6-4-spades-after-denial",
    and(hcpMin(10), suitMin(0, "spades", 6), suitMin(1, "hearts", 4)),
    // 4S signoff: 6S+4H, game values, bid game directly
    bid("stayman-rebid-major-game-64", "Bids game with 6-4 major shape", (): Call => ({ type: "bid", level: 4, strain: BidSuit.Spades })),
    handDecision(
      "smolen-hearts",
      and(hcpMin(10), suitMin(0, "spades", 4), suitMin(1, "hearts", 5)),
      // 3H Smolen: shows 4S+5H, game-forcing
      bid("stayman-rebid-smolen-hearts", "Shows 5 hearts and 4 spades", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts })),
      handDecision(
        "smolen-spades",
        and(hcpMin(10), suitMin(0, "spades", 5), suitMin(1, "hearts", 4)),
        // 3S Smolen: shows 5S+4H, game-forcing
        bid("stayman-rebid-smolen-spades", "Shows 5 spades and 4 hearts", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Spades })),
        // Check minor suit GF after denial
        handDecision(
          "minor-gf-after-2d",
          and(hcpMin(10), suitMin(2, "diamonds", 5)),
          bid("stayman-rebid-minor-gf", "Shows 5+ diamonds, game-forcing", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
          handDecision(
            "clubs-gf-after-2d",
            and(hcpMin(10), suitMin(3, "clubs", 5)),
            bid("stayman-rebid-minor-gf", "Shows 5+ clubs, game-forcing", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
            // Check invitational 2H/2S with 5-4 majors (8-9 HCP)
            handDecision(
              "invite-hearts-after-denial",
              and(hcpRange(8, 9), suitMin(1, "hearts", 5), suitMin(0, "spades", 4)),
              // 2H invitational: 5H+4S, non-forcing (invitational counterpart to Smolen)
              bid("stayman-rebid-invite-major", "Shows 5 hearts and 4 spades, invitational", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
              handDecision(
                "invite-spades-after-denial",
                and(hcpRange(8, 9), suitMin(0, "spades", 5), suitMin(1, "hearts", 4)),
                // 2S invitational: 5S+4H, non-forcing (invitational counterpart to Smolen)
                bid("stayman-rebid-invite-major", "Shows 5 spades and 4 hearts, invitational", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Spades })),
                // Default: NT game or invite
                handDecision(
                  "game-hcp-denial",
                  hcpMin(10),
                  bid("stayman-rebid-no-fit", "Bids game in notrump without a major fit", (): Call => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
                  bid("stayman-rebid-no-fit-invite", "Invites game in notrump without a major fit", (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  ),
);

// ─── 2NT Opening Stayman (3C ask) ────────────────────────────

// Round 1: Responder asks 3C (after 2NT-P)
const round1Ask2NT = handDecision(
  "hcp-8-plus-2nt",
  hcpMin(8),
  handDecision(
    "has-4-card-major-2nt",
    anySuitMin(
      [
        { index: 0, name: "spades" },
        { index: 1, name: "hearts" },
      ],
      4,
    ),
    bid("stayman-ask", "Asks for a 4-card major", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
    fallback("no-major-2nt"),
  ),
  fallback("too-weak-2nt"),
);

// Round 2: Opener responds (after 2NT-P-3C-P)
const round2Response2NT = handDecision(
  "has-4-hearts-2nt",
  suitMin(1, "hearts", 4),
  bid("stayman-response-hearts", "Shows 4+ hearts", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts })),
  handDecision(
    "has-4-spades-2nt",
    suitMin(0, "spades", 4),
    bid("stayman-response-spades", "Shows 4+ spades but denies 4 hearts", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Spades })),
    bid("stayman-response-denial", "Denies holding a 4-card major", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
  ),
);

// ─── Protocol ────────────────────────────────────────────────

export const staymanProtocol: ConventionProtocol<StaymanEstablished> = protocol<StaymanEstablished>("stayman", [
  // Round 1: NT opening — responder decides whether to ask Stayman
  // seatFilter: responder + no interference after the NT opening
  round<StaymanEstablished>("nt-opening", {
    triggers: [
      semantic<StaymanEstablished>(bidMade(1, BidSuit.NoTrump), { openingLevel: 1 }),
      semantic<StaymanEstablished>(bidMade(2, BidSuit.NoTrump), { openingLevel: 2 }),
    ],
    handTree: (est: StaymanEstablished): HandNode =>
      est.openingLevel === 2 ? round1Ask2NT : round1Ask,
    seatFilter: and(isResponder(), lastEntryIsPass()) as AuctionCondition,
  }),
  // Round 2: Stayman ask made — opener responds with major or denial
  // seatFilter: opener + no interference after the Stayman ask
  round<StaymanEstablished>("stayman-ask", {
    triggers: [
      semantic<StaymanEstablished>(bidMade(2, BidSuit.Clubs), {}),
      semantic<StaymanEstablished>(bidMade(3, BidSuit.Clubs), {}),
    ],
    handTree: (est: StaymanEstablished): HandNode =>
      est.openingLevel === 2 ? round2Response2NT : round2Response,
    seatFilter: and(isOpener(), lastEntryIsPass()) as AuctionCondition,
  }),
  // Round 3: Opener responded — responder rebids based on what was shown
  // seatFilter: responder + no interference after opener's response
  round<StaymanEstablished>("opener-response", {
    triggers: [
      semantic<StaymanEstablished>(bidMade(2, BidSuit.Hearts), { showed: "hearts" }),
      semantic<StaymanEstablished>(bidMade(2, BidSuit.Spades), { showed: "spades" }),
      semantic<StaymanEstablished>(bidMade(2, BidSuit.Diamonds), { showed: "denial" }),
      semantic<StaymanEstablished>(bidMade(3, BidSuit.Hearts), { showed: "hearts" }),
      semantic<StaymanEstablished>(bidMade(3, BidSuit.Spades), { showed: "spades" }),
      semantic<StaymanEstablished>(bidMade(3, BidSuit.Diamonds), { showed: "denial" }),
    ],
    handTree: (est: StaymanEstablished): HandNode => {
      if (est.showed === "hearts") return rebidAfter2H;
      if (est.showed === "spades") return rebidAfter2S;
      if (est.showed === "denial") return rebidAfter2D;
      return fallback("unknown-response");
    },
    seatFilter: and(isResponder(), lastEntryIsPass()) as AuctionCondition,
  }),
]);
