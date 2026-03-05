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
import type { AuctionCondition, HandCondition } from "../../core/types";
import { handDecision } from "../../core/rule-tree";
import type { HandNode } from "../../core/rule-tree";
import { intentBid } from "../../core/intent/intent-node";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import { protocol, round, semantic } from "../../core/protocol";
import type { ConventionProtocol, EstablishedContext } from "../../core/protocol";

const bid = intentBid;

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

function round1ResponderTree(overcallSuit: BidSuit): HandNode {
  const overcall = suitDetails(overcallSuit);

  return handDecision(
    "hcp-10-plus",
    hcpMin(10),
    handDecision(
      `has-4-${overcall.name}`,
      suitMin(overcall.index, overcall.name, 4),
      bid(
        "lebensohl-penalty-double",
        "Doubles for penalty against the overcall",
        { type: SemanticIntentType.PenaltyDouble, params: { suit: overcall.name } },
        (): Call => ({ type: "double" }),
      ),
      handDecision(
        "has-5-spades-direct-gf",
        suitMin(0, "spades", 5),
        bid(
          "lebensohl-direct-gf-spades",
          "Bids directly to show a game-forcing spade suit",
          { type: SemanticIntentType.ForceGame, params: { strain: "spades", level: 3 } },
          (): Call => ({ type: "bid", level: 3, strain: BidSuit.Spades }),
        ),
        handDecision(
          "has-5-hearts-direct-gf",
          suitMin(1, "hearts", 5),
          bid(
            "lebensohl-direct-gf-hearts",
            "Bids directly to show a game-forcing heart suit",
            { type: SemanticIntentType.ForceGame, params: { strain: "hearts", level: 3 } },
            (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts }),
          ),
          handDecision(
            "has-5-diamonds-direct-gf",
            suitMin(2, "diamonds", 5),
            bid(
              "lebensohl-direct-gf-diamonds",
              "Bids directly to show a game-forcing diamond suit",
              { type: SemanticIntentType.ForceGame, params: { strain: "diamonds", level: 3 } },
              (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds }),
            ),
            handDecision(
              "has-5-clubs-direct-gf",
              suitMin(3, "clubs", 5),
              bid(
                "lebensohl-direct-gf-clubs",
                "Bids directly to show a game-forcing club suit",
                { type: SemanticIntentType.ForceGame, params: { strain: "clubs", level: 3 } },
                (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs }),
              ),
              bid(
                "lebensohl-relay",
                "Uses 2NT as an artificial relay to 3C",
                { type: SemanticIntentType.ArtificialRelay, params: {} },
                (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump }),
              ),
            ),
          ),
        ),
      ),
    ),
    bid(
      "lebensohl-weak-signoff",
      "Passes with a weak hand after interference",
      { type: SemanticIntentType.CompetitivePass, params: {} },
      (): Call => ({ type: "pass" }),
    ),
  );
}

const round2RelayAcceptTree: HandNode = bid(
  "lebensohl-relay-accept",
  "Accepts partner's relay by bidding 3C",
  { type: SemanticIntentType.AcceptTransfer, params: { strain: "clubs", level: 3 } },
  (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs }),
);

function round3ResponderContinuationTree(overcallSuit: BidSuit): HandNode {
  return handDecision(
    "game-values-with-stopper",
    and(hcpMin(10), stopperInSuit(overcallSuit)),
    bid(
      "lebensohl-relay-3nt",
      "Shows game values and a stopper, then bids 3NT",
      { type: SemanticIntentType.ForceGame, params: { strain: "notrump", level: 3 } },
      (): Call => ({ type: "bid", level: 3, strain: BidSuit.NoTrump }),
    ),
    handDecision(
      "weak-clubs-signoff",
      and(hcpRange(0, 9), suitMin(3, "clubs", 5)),
      bid(
        "lebensohl-relay-pass-clubs",
        "Passes 3C with weak values and club length",
        { type: SemanticIntentType.CompetitivePass, params: {} },
        (): Call => ({ type: "pass" }),
      ),
      handDecision(
        "signoff-spades",
        suitMin(0, "spades", 5),
        bid(
          "lebensohl-relay-signoff-spades",
          "After the relay, signs off in spades",
          { type: SemanticIntentType.Signoff, params: { strain: "spades", level: 3 } },
          (): Call => ({ type: "bid", level: 3, strain: BidSuit.Spades }),
        ),
        handDecision(
          "signoff-hearts",
          suitMin(1, "hearts", 5),
          bid(
            "lebensohl-relay-signoff-hearts",
            "After the relay, signs off in hearts",
            { type: SemanticIntentType.Signoff, params: { strain: "hearts", level: 3 } },
            (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts }),
          ),
          handDecision(
            "signoff-diamonds",
            suitMin(2, "diamonds", 5),
            bid(
              "lebensohl-relay-signoff-diamonds",
              "After the relay, signs off in diamonds",
              { type: SemanticIntentType.Signoff, params: { strain: "diamonds", level: 3 } },
              (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds }),
            ),
            bid(
              "lebensohl-relay-pass-default",
              "Without a suitable signoff, passes 3C",
              { type: SemanticIntentType.CompetitivePass, params: {} },
              (): Call => ({ type: "pass" }),
            ),
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
        seatFilter: and(isResponder(), biddingRound(0)) as AuctionCondition,
      }),
      round<LebensohlLiteEstablished>("relay-completion", {
        triggers: [
          semantic<LebensohlLiteEstablished>(bidMade(2, BidSuit.NoTrump), {}),
        ],
        handTree: round2RelayAcceptTree,
        seatFilter: and(isOpener(), passedAfter(2, BidSuit.NoTrump)) as AuctionCondition,
      }),
      round<LebensohlLiteEstablished>("continuation", {
        triggers: [
          semantic<LebensohlLiteEstablished>(bidMade(3, BidSuit.Clubs), {}),
        ],
        handTree: (established) =>
          round3ResponderContinuationTree(established.overcallSuit ?? BidSuit.Diamonds),
        seatFilter: and(isResponder(), passedAfter(3, BidSuit.Clubs)) as AuctionCondition,
      }),
    ],
  );
