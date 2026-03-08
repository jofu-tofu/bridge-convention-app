import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import {
  and,
  biddingRound,
  bidMade,
  hcpMin,
  hcpRange,
  isOpener,
  isResponder,
  opponentBidMade,
  passedAfter,
  suitMin,
  suitQuality,
} from "../../core/conditions";
import type { HandCondition } from "../../core/types";
import { handDecision } from "../../core/tree/rule-tree";
import type { HandNode } from "../../core/tree/rule-tree";
import { createIntentBidFactory } from "../../core/intent/intent-node";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import { protocol, round, semantic } from "../../core/protocol/protocol";
import type { ConventionProtocol, EstablishedContext } from "../../core/protocol/protocol";

const bid = createIntentBidFactory("lebensohl");

interface LebensohlLiteEstablished extends EstablishedContext {
  overcallSuit?: BidSuit;
}

interface SuitDetails {
  readonly index: number;
  readonly name: "spades" | "hearts" | "diamonds" | "clubs";
}

function suitDetails(suit: BidSuit): SuitDetails {
  switch (suit) {
    case BidSuit.Spades:
      return { index: 0, name: "spades" };
    case BidSuit.Hearts:
      return { index: 1, name: "hearts" };
    case BidSuit.Diamonds:
      return { index: 2, name: "diamonds" };
    case BidSuit.Clubs:
      return { index: 3, name: "clubs" };
    default:
      return { index: 2, name: "diamonds" };
  }
}

function stopperInSuit(suit: BidSuit): HandCondition {
  const details = suitDetails(suit);
  return suitQuality(details.index, details.name, 1);
}

// --- IntentNode leaves (created once at module load for factory uniqueness) ---

// Round 1: Strong hand (10+ HCP)
const penaltyDoubleNode = bid(
  "lebensohl-penalty-double",
  "Doubles for penalty against the overcall",
  { type: SemanticIntentType.PenaltyDouble, params: {} },
  (): Call => ({ type: "double" }),
);

const directGfSpadesNode = bid(
  "lebensohl-direct-gf-spades",
  "Bids directly to show a game-forcing spade suit",
  { type: SemanticIntentType.ForceGame, params: { strain: "spades", level: 3 } },
  (): Call => ({ type: "bid", level: 3, strain: BidSuit.Spades }),
);

const directGfHeartsNode = bid(
  "lebensohl-direct-gf-hearts",
  "Bids directly to show a game-forcing heart suit",
  { type: SemanticIntentType.ForceGame, params: { strain: "hearts", level: 3 } },
  (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts }),
);

const directGfDiamondsNode = bid(
  "lebensohl-direct-gf-diamonds",
  "Bids directly to show a game-forcing diamond suit",
  { type: SemanticIntentType.ForceGame, params: { strain: "diamonds", level: 3 } },
  (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds }),
);

const directGfClubsNode = bid(
  "lebensohl-direct-gf-clubs",
  "Bids directly to show a game-forcing club suit",
  { type: SemanticIntentType.ForceGame, params: { strain: "clubs", level: 3 } },
  (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs }),
);

const relayWithStopperNode = bid(
  "lebensohl-relay-with-stopper",
  "Uses 2NT relay with a stopper for the slow shows path to 3NT",
  { type: SemanticIntentType.ArtificialRelay, params: {} },
  (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump }),
);

const direct3ntNode = bid(
  "lebensohl-direct-3nt",
  "Bids 3NT directly, denying a stopper in the overcalled suit (fast denies)",
  { type: SemanticIntentType.ForceGame, params: { strain: "notrump", level: 3 } },
  (): Call => ({ type: "bid", level: 3, strain: BidSuit.NoTrump }),
);

// Round 1: Weak hand (0-9 HCP) — relay to sign off
const weakRelayClubsNode = bid(
  "lebensohl-weak-relay-clubs",
  "Weak hand uses 2NT relay to sign off in clubs",
  { type: SemanticIntentType.ArtificialRelay, params: {} },
  (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump }),
);

const weakRelayDiamondsNode = bid(
  "lebensohl-weak-relay-diamonds",
  "Weak hand uses 2NT relay to sign off in diamonds",
  { type: SemanticIntentType.ArtificialRelay, params: {} },
  (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump }),
);

const weakRelayHeartsNode = bid(
  "lebensohl-weak-relay-hearts",
  "Weak hand uses 2NT relay to sign off in hearts",
  { type: SemanticIntentType.ArtificialRelay, params: {} },
  (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump }),
);

const weakRelaySpadesNode = bid(
  "lebensohl-weak-relay-spades",
  "Weak hand uses 2NT relay to sign off in spades",
  { type: SemanticIntentType.ArtificialRelay, params: {} },
  (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump }),
);

const weakSignoffNode = bid(
  "lebensohl-weak-signoff",
  "Passes with a weak hand after interference",
  { type: SemanticIntentType.CompetitivePass, params: {} },
  (): Call => ({ type: "pass" }),
);

// Round 2: Opener relay accept
const relayAcceptNode = bid(
  "lebensohl-relay-accept",
  "Accepts partner's relay by bidding 3C",
  { type: SemanticIntentType.AcceptTransfer, params: { strain: "clubs", level: 3 } },
  (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs }),
);

// Round 3: Responder continuation after relay
const slow3ntNode = bid(
  "lebensohl-slow-3nt",
  "Bids 3NT via the slow shows path, confirming a stopper in the overcalled suit",
  { type: SemanticIntentType.ForceGame, params: { strain: "notrump", level: 3 } },
  (): Call => ({ type: "bid", level: 3, strain: BidSuit.NoTrump }),
);

const relayPassClubsNode = bid(
  "lebensohl-relay-pass-clubs",
  "Passes 3C with weak values and club length",
  { type: SemanticIntentType.CompetitivePass, params: {} },
  (): Call => ({ type: "pass" }),
);

const relaySignoffSpadesNode = bid(
  "lebensohl-relay-signoff-spades",
  "After the relay, signs off in spades",
  { type: SemanticIntentType.Signoff, params: { strain: "spades", level: 3 } },
  (): Call => ({ type: "bid", level: 3, strain: BidSuit.Spades }),
);

const relaySignoffHeartsNode = bid(
  "lebensohl-relay-signoff-hearts",
  "After the relay, signs off in hearts",
  { type: SemanticIntentType.Signoff, params: { strain: "hearts", level: 3 } },
  (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts }),
);

const relaySignoffDiamondsNode = bid(
  "lebensohl-relay-signoff-diamonds",
  "After the relay, signs off in diamonds",
  { type: SemanticIntentType.Signoff, params: { strain: "diamonds", level: 3 } },
  (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds }),
);

const relayPassDefaultNode = bid(
  "lebensohl-relay-pass-default",
  "Without a suitable signoff, passes 3C",
  { type: SemanticIntentType.CompetitivePass, params: {} },
  (): Call => ({ type: "pass" }),
);

// --- Hand decision trees (parameterized by overcall suit, safe to call multiple times) ---

function round1ResponderTree(overcallSuit: BidSuit): HandNode {
  const overcall = suitDetails(overcallSuit);

  return handDecision(
    "hcp-10-plus",
    hcpMin(10),
    // Strong hand (10+ HCP)
    handDecision(
      `has-4-${overcall.name}`,
      suitMin(overcall.index, overcall.name, 4),
      penaltyDoubleNode,
      handDecision(
        "has-5-spades-direct-gf",
        suitMin(0, "spades", 5),
        directGfSpadesNode,
        handDecision(
          "has-5-hearts-direct-gf",
          suitMin(1, "hearts", 5),
          directGfHeartsNode,
          handDecision(
            "has-5-diamonds-direct-gf",
            suitMin(2, "diamonds", 5),
            directGfDiamondsNode,
            handDecision(
              "has-5-clubs-direct-gf",
              suitMin(3, "clubs", 5),
              directGfClubsNode,
              // No 5-card suit: stopper check for slow shows / fast denies
              handDecision(
                "has-stopper-for-relay",
                stopperInSuit(overcallSuit),
                relayWithStopperNode,
                direct3ntNode,
              ),
            ),
          ),
        ),
      ),
    ),
    // Weak hand (0-9 HCP): relay with a 5+ card suit, otherwise pass
    handDecision(
      "weak-has-5-clubs",
      suitMin(3, "clubs", 5),
      weakRelayClubsNode,
      handDecision(
        "weak-has-5-diamonds",
        suitMin(2, "diamonds", 5),
        weakRelayDiamondsNode,
        handDecision(
          "weak-has-5-hearts",
          suitMin(1, "hearts", 5),
          weakRelayHeartsNode,
          handDecision(
            "weak-has-5-spades",
            suitMin(0, "spades", 5),
            weakRelaySpadesNode,
            weakSignoffNode,
          ),
        ),
      ),
    ),
  );
}

function round3ResponderContinuationTree(overcallSuit: BidSuit): HandNode {
  return handDecision(
    "game-values-with-stopper",
    and(hcpMin(10), stopperInSuit(overcallSuit)),
    slow3ntNode,
    handDecision(
      "weak-clubs-signoff",
      and(hcpRange(0, 9), suitMin(3, "clubs", 5)),
      relayPassClubsNode,
      handDecision(
        "signoff-spades",
        suitMin(0, "spades", 5),
        relaySignoffSpadesNode,
        handDecision(
          "signoff-hearts",
          suitMin(1, "hearts", 5),
          relaySignoffHeartsNode,
          handDecision(
            "signoff-diamonds",
            suitMin(2, "diamonds", 5),
            relaySignoffDiamondsNode,
            relayPassDefaultNode,
          ),
        ),
      ),
    ),
  );
}

export const lebensohlLiteProtocol: ConventionProtocol<LebensohlLiteEstablished> =
  protocol<LebensohlLiteEstablished>(
    "lebensohl-lite",
    [
      round<LebensohlLiteEstablished>("overcall", {
        triggers: [
          semantic<LebensohlLiteEstablished>(
            opponentBidMade(2, BidSuit.Diamonds),
            { overcallSuit: BidSuit.Diamonds },
          ),
          semantic<LebensohlLiteEstablished>(
            opponentBidMade(2, BidSuit.Hearts),
            { overcallSuit: BidSuit.Hearts },
          ),
          semantic<LebensohlLiteEstablished>(
            opponentBidMade(2, BidSuit.Spades),
            { overcallSuit: BidSuit.Spades },
          ),
        ],
        handTree: (established) => round1ResponderTree(established.overcallSuit ?? BidSuit.Diamonds),
        seatFilter: and(isResponder(), biddingRound(0)),
      }),
      round<LebensohlLiteEstablished>("relay-completion", {
        triggers: [
          semantic<LebensohlLiteEstablished>(bidMade(2, BidSuit.NoTrump), {}),
        ],
        handTree: relayAcceptNode,
        seatFilter: and(isOpener(), passedAfter(2, BidSuit.NoTrump)),
      }),
      round<LebensohlLiteEstablished>("continuation", {
        triggers: [
          semantic<LebensohlLiteEstablished>(bidMade(3, BidSuit.Clubs), {}),
        ],
        handTree: (established) =>
          round3ResponderContinuationTree(established.overcallSuit ?? BidSuit.Diamonds),
        seatFilter: and(isResponder(), passedAfter(3, BidSuit.Clubs)),
      }),
    ],
  );
