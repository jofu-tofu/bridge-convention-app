import type { Call } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";
import {
  hcpMin,
  hcpRange,
  suitMin,
  suitBelow,
  isOpener,
  isResponder,
  partnerOpened,
  partnerOpenedAt,
  opponentBid,
  isBalanced,
  noFiveCardMajor,
  longerMajor,
  noPriorBid,
  seatHasBid,
  not,
  and,
  or,
  hasFourCardMajor,
  partnerOpenedMajor,
  partnerOpenedMinor,
  majorSupportN,
  partnerRaisedOurMajor,
  partnerRespondedMajorWithSupport,
  sixPlusInOpenedSuit,
  goodSuitAtLevel,
  auctionMatchesAny,
} from "../../core/conditions";
import type { AuctionCondition } from "../../core/types";
import { decision, handDecision } from "../../core/rule-tree";
import type { HandNode, RuleNode } from "../../core/rule-tree";
import { intentBid } from "../../core/intent/intent-node";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import { protocol, round, semantic } from "../../core/protocol";
import type { ConventionProtocol, EstablishedContext } from "../../core/protocol";
import {
  respondRaiseMajorCall,
  respondJumpRaiseMajorCall,
  respondGameRaiseMajorCall,
  rebid4mAfterRaiseCall,
  rebid3mInviteCall,
  rebidRaisePartnerMajorCall,
  rebidOwnSuitCall,
  overcall1LevelCall,
  overcall2LevelCall,
  saycPass,
  respondWeakRaiseCall,
  openerAcceptTransferCall,
} from "./helpers";

// ─── Established context ────────────────────────────────────

interface SAYCEstablished extends EstablishedContext {
  slotName: string;
}

// ─── Opening subtrees ───────────────────────────────────────

// Preempts (7+ card) checked BEFORE weak twos (6+ card) so 7-card hands open at 3-level
const weakAndPreemptBranch: HandNode = handDecision(
  "preempt-7spades",
  and(hcpRange(5, 11), suitMin(0, "spades", 7)),
  intentBid("sayc-open-3s", "Opens showing a 7-card spade suit",
    { type: SemanticIntentType.PreemptiveOpen, params: { level: 3, strain: "S" } },
    (): Call => ({ type: "bid", level: 3, strain: BidSuit.Spades })),
  handDecision(
    "preempt-7hearts",
    and(hcpRange(5, 11), suitMin(1, "hearts", 7)),
    intentBid("sayc-open-3h", "Opens showing a 7-card heart suit",
      { type: SemanticIntentType.PreemptiveOpen, params: { level: 3, strain: "H" } },
      (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts })),
    handDecision(
      "preempt-7diamonds",
      and(hcpRange(5, 11), suitMin(2, "diamonds", 7)),
      intentBid("sayc-open-3d", "Opens showing a 7-card diamond suit",
        { type: SemanticIntentType.PreemptiveOpen, params: { level: 3, strain: "D" } },
        (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
      handDecision(
        "preempt-7clubs",
        and(hcpRange(5, 11), suitMin(3, "clubs", 7)),
        intentBid("sayc-open-3c", "Opens showing a 7-card club suit",
          { type: SemanticIntentType.PreemptiveOpen, params: { level: 3, strain: "C" } },
          (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
        handDecision(
          "weak-6hearts",
          and(hcpRange(5, 11), suitMin(1, "hearts", 6)),
          intentBid("sayc-open-weak-2h", "Opens showing a 6-card heart suit",
            { type: SemanticIntentType.PreemptiveOpen, params: { level: 2, strain: "H" } },
            (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
          handDecision(
            "weak-6spades",
            and(hcpRange(5, 11), suitMin(0, "spades", 6)),
            intentBid("sayc-open-weak-2s", "Opens showing a 6-card spade suit",
              { type: SemanticIntentType.PreemptiveOpen, params: { level: 2, strain: "S" } },
              (): Call => ({ type: "bid", level: 2, strain: BidSuit.Spades })),
            handDecision(
              "weak-6diamonds",
              and(hcpRange(5, 11), suitMin(2, "diamonds", 6)),
              intentBid("sayc-open-weak-2d", "Opens showing a 6-card diamond suit",
                { type: SemanticIntentType.PreemptiveOpen, params: { level: 2, strain: "D" } },
                (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds })),
              saycPass(),
            ),
          ),
        ),
      ),
    ),
  ),
);

const openMinorBranch: HandNode = handDecision(
  "12+-4diamonds",
  and(hcpMin(12), suitBelow(0, "spades", 5), suitBelow(1, "hearts", 5), suitMin(2, "diamonds", 4)),
  intentBid("sayc-open-1d", "Opens in the longer minor",
    { type: SemanticIntentType.NaturalBid, params: { level: 1, strain: "D" } },
    (): Call => ({ type: "bid", level: 1, strain: BidSuit.Diamonds })),
  handDecision(
    "12+-3clubs",
    and(hcpMin(12), suitBelow(0, "spades", 5), suitBelow(1, "hearts", 5), suitMin(3, "clubs", 3)),
    intentBid("sayc-open-1c", "Opens the better minor",
      { type: SemanticIntentType.NaturalBid, params: { level: 1, strain: "C" } },
      (): Call => ({ type: "bid", level: 1, strain: BidSuit.Clubs })),
    handDecision(
      "12+-3diamonds-fallback",
      and(hcpMin(12), suitBelow(0, "spades", 5), suitBelow(1, "hearts", 5), suitMin(2, "diamonds", 3)),
      intentBid("sayc-open-1d", "Opens the longer minor",
        { type: SemanticIntentType.NaturalBid, params: { level: 1, strain: "D" } },
        (): Call => ({ type: "bid", level: 1, strain: BidSuit.Diamonds })),
      weakAndPreemptBranch,
    ),
  ),
);

const openMajorBranch: HandNode = handDecision(
  "12+-longer-spades",
  and(hcpMin(12), longerMajor(0, "spades")),
  intentBid("sayc-open-1s", "Opens in the longest major",
    { type: SemanticIntentType.NaturalBid, params: { level: 1, strain: "S" } },
    (): Call => ({ type: "bid", level: 1, strain: BidSuit.Spades })),
  handDecision(
    "12+-5hearts",
    and(hcpMin(12), suitMin(1, "hearts", 5)),
    intentBid("sayc-open-1h", "Opens showing 5+ hearts",
      { type: SemanticIntentType.NaturalBid, params: { level: 1, strain: "H" } },
      (): Call => ({ type: "bid", level: 1, strain: BidSuit.Hearts })),
    openMinorBranch,
  ),
);

const openingBranch: HandNode = handDecision(
  "hcp-22+",
  hcpMin(22),
  intentBid("sayc-open-2c", "Opens artificial and forcing for one round",
    { type: SemanticIntentType.ForceGame, params: { level: 2, strain: "C" } },
    (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
  handDecision(
    "hcp-20-21-balanced",
    and(hcpRange(20, 21), isBalanced()),
    intentBid("sayc-open-2nt", "Opens showing a balanced hand",
      { type: SemanticIntentType.NaturalBid, params: { level: 2, strain: "NT" } },
      (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
    handDecision(
      "hcp-15-17-bal-no5M",
      and(hcpRange(15, 17), isBalanced(), noFiveCardMajor()),
      intentBid("sayc-open-1nt", "Opens showing a balanced hand",
        { type: SemanticIntentType.NaturalBid, params: { level: 1, strain: "NT" } },
        (): Call => ({ type: "bid", level: 1, strain: BidSuit.NoTrump })),
      openMajorBranch,
    ),
  ),
);

// ─── Responses to 1NT opening ───────────────────────────────

const respond1NTBranch: HandNode = handDecision(
  "transfer-5+hearts",
  suitMin(1, "hearts", 5),
  intentBid("sayc-respond-1nt-transfer-hearts", "Transfers to hearts showing 5+ hearts",
    { type: SemanticIntentType.TransferTo, params: { strain: "H" } },
    (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds })),
  handDecision(
    "transfer-5+spades",
    suitMin(0, "spades", 5),
    intentBid("sayc-respond-1nt-transfer-spades", "Transfers to spades showing 5+ spades",
      { type: SemanticIntentType.TransferTo, params: { strain: "S" } },
      (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
    handDecision(
      "8+-with-4M",
      and(hcpMin(8), hasFourCardMajor()),
      intentBid("sayc-respond-1nt-stayman", "Asks opener for a 4-card major",
        { type: SemanticIntentType.AskForMajor, params: {} },
        (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
      handDecision(
        "10-15-balanced-3nt",
        and(hcpRange(10, 15), isBalanced()),
        intentBid("sayc-respond-1nt-3nt", "Raises to game in notrump",
          { type: SemanticIntentType.ForceGame, params: { level: 3, strain: "NT" } },
          (): Call => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
        handDecision(
          "8-9-balanced-invite",
          and(hcpRange(8, 9), isBalanced()),
          intentBid("sayc-respond-1nt-2nt", "Invites game in notrump",
            { type: SemanticIntentType.InviteGame, params: { level: 2, strain: "NT" } },
            (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
          handDecision(
            "0-7-hcp",
            hcpRange(0, 7),
            intentBid("sayc-respond-1nt-pass", "Declines to respond to the notrump opening",
              { type: SemanticIntentType.Signoff, params: {} },
              (): Call => ({ type: "pass" })),
            saycPass(),
          ),
        ),
      ),
    ),
  ),
);

// ─── Responses to 2NT opening ───────────────────────────────

const respond2NTBranch: HandNode = handDecision(
  "resp-2nt-transfer-5+hearts",
  and(hcpMin(4), suitMin(1, "hearts", 5)),
  intentBid("sayc-respond-2nt-transfer-hearts", "Transfers to hearts showing 5+ hearts",
    { type: SemanticIntentType.TransferTo, params: { strain: "H" } },
    (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
  handDecision(
    "resp-2nt-transfer-5+spades",
    and(hcpMin(4), suitMin(0, "spades", 5)),
    intentBid("sayc-respond-2nt-transfer-spades", "Transfers to spades showing 5+ spades",
      { type: SemanticIntentType.TransferTo, params: { strain: "S" } },
      (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts })),
    handDecision(
      "resp-2nt-stayman",
      and(hcpMin(4), hasFourCardMajor()),
      intentBid("sayc-respond-2nt-stayman", "Asks opener for a 4-card major",
        { type: SemanticIntentType.AskForMajor, params: {} },
        (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
      handDecision(
        "resp-2nt-3nt",
        and(hcpRange(4, 10), isBalanced()),
        intentBid("sayc-respond-2nt-3nt", "Raises to game in notrump",
          { type: SemanticIntentType.ForceGame, params: { level: 3, strain: "NT" } },
          (): Call => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
        handDecision(
          "resp-2nt-pass",
          hcpRange(0, 3),
          intentBid("sayc-respond-2nt-pass", "Declines to respond with a weak hand",
            { type: SemanticIntentType.Signoff, params: {} },
            (): Call => ({ type: "pass" })),
          saycPass(),
        ),
      ),
    ),
  ),
);

// ─── Responses to strong 2C opening ─────────────────────────

const respond2CBranch: HandNode = handDecision(
  "resp-2c-positive-spades",
  and(hcpMin(8), suitMin(0, "spades", 5)),
  intentBid("sayc-respond-2c-positive-spades", "Shows a positive response with 5+ spades",
    { type: SemanticIntentType.ForceGame, params: { level: 2, strain: "S" } },
    (): Call => ({ type: "bid", level: 2, strain: BidSuit.Spades })),
  handDecision(
    "resp-2c-positive-hearts",
    and(hcpMin(8), suitMin(1, "hearts", 5)),
    intentBid("sayc-respond-2c-positive-hearts", "Shows a positive response with 5+ hearts",
      { type: SemanticIntentType.ForceGame, params: { level: 2, strain: "H" } },
      (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
    handDecision(
      "resp-2c-positive-diamonds",
      and(hcpMin(8), suitMin(2, "diamonds", 5)),
      intentBid("sayc-respond-2c-positive-diamonds", "Shows a positive response with 5+ diamonds",
        { type: SemanticIntentType.ForceGame, params: { level: 3, strain: "D" } },
        (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
      handDecision(
        "resp-2c-positive-clubs",
        and(hcpMin(8), suitMin(3, "clubs", 5)),
        intentBid("sayc-respond-2c-positive-clubs", "Shows a positive response with 5+ clubs",
          { type: SemanticIntentType.ForceGame, params: { level: 3, strain: "C" } },
          (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
        handDecision(
          "resp-2c-positive-2nt",
          and(hcpMin(8), isBalanced()),
          intentBid("sayc-respond-2c-2nt", "Shows a positive balanced hand",
            { type: SemanticIntentType.ForceGame, params: { level: 2, strain: "NT" } },
            (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
          intentBid("sayc-respond-2c-2d-waiting", "Responds with an artificial waiting bid",
            { type: SemanticIntentType.NaturalBid, params: { level: 2, strain: "D" } },
            (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds })),
        ),
      ),
    ),
  ),
);

// ─── Responses to weak two bids ─────────────────────────────

const respondWeakTwoBranch: HandNode = handDecision(
  "resp-weak2-2nt-feature",
  hcpMin(16),
  intentBid("sayc-respond-weak2-2nt", "Asks opener to describe hand further",
    { type: SemanticIntentType.AskHandQuality, params: {} },
    (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
  handDecision(
    "resp-weak2-raise",
    and(hcpRange(6, 15), majorSupportN(3)),
    intentBid("sayc-respond-weak2-raise", "Raises partner's weak two bid",
      { type: SemanticIntentType.ShowSupport, params: { level: 3 } },
      respondWeakRaiseCall),
    saycPass(),
  ),
);

// ─── Responses to suit openings ─────────────────────────────

function makeRespondNTBranch(): HandNode {
  return handDecision(
    "respond-1nt-6-10",
    hcpRange(6, 10),
    intentBid("sayc-respond-1nt", "Responds showing a balanced hand",
      { type: SemanticIntentType.NaturalBid, params: { level: 1, strain: "NT" } },
      (): Call => ({ type: "bid", level: 1, strain: BidSuit.NoTrump })),
    handDecision(
      "respond-2nt-13-15",
      and(hcpRange(13, 15), isBalanced()),
      intentBid("sayc-respond-2nt", "Shows an invitational balanced hand",
        { type: SemanticIntentType.InviteGame, params: { level: 2, strain: "NT" } },
        (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
      handDecision(
        "respond-3nt-16-18",
        and(hcpRange(16, 18), isBalanced()),
        intentBid("sayc-respond-3nt", "Shows a game-forcing balanced hand",
          { type: SemanticIntentType.ForceGame, params: { level: 3, strain: "NT" } },
          (): Call => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
        saycPass(),
      ),
    ),
  );
}

function makeRespond2Over1Branch(): HandNode {
  return handDecision(
    "respond-2c-over-major",
    and(hcpMin(10), suitMin(3, "clubs", 4)),
    intentBid("sayc-respond-2c-over-major", "Responds in a new suit, forcing",
      { type: SemanticIntentType.ShowHeldSuit, params: { level: 2, strain: "C" } },
      (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
    handDecision(
      "respond-2d-over-major",
      and(hcpMin(10), suitMin(2, "diamonds", 4)),
      intentBid("sayc-respond-2d-over-major", "Responds in a new suit, forcing",
        { type: SemanticIntentType.ShowHeldSuit, params: { level: 2, strain: "D" } },
        (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds })),
      makeRespondNTBranch(),
    ),
  );
}

function makeMajorRaiseBranch(noRaiseFallback: HandNode): HandNode {
  return handDecision(
    "game-raise-13+",
    and(hcpMin(13), majorSupportN(4)),
    intentBid("sayc-respond-game-raise-major", "Raises partner's major directly to game",
      { type: SemanticIntentType.ForceGame, params: {} },
      respondGameRaiseMajorCall),
    handDecision(
      "jump-raise-10-12",
      and(hcpRange(10, 12), majorSupportN(4)),
      intentBid("sayc-respond-jump-raise-major", "Makes a limit raise in partner's major",
        { type: SemanticIntentType.ShowSupport, params: { level: 3 } },
        respondJumpRaiseMajorCall),
      handDecision(
        "simple-raise-6-10",
        and(hcpRange(6, 10), majorSupportN(3)),
        intentBid("sayc-respond-raise-major", "Makes a simple raise in partner's major",
          { type: SemanticIntentType.ShowSupport, params: { level: 2 } },
          respondRaiseMajorCall),
        noRaiseFallback,
      ),
    ),
  );
}

// ─── Responder dispatch via hand tree ───────────────────────

function makeResponderHandTree(): RuleNode {
  // Dispatch via auction conditions that check partner's opening
  return decision(
    "partner-opened-1nt-check",
    partnerOpenedAt(1, BidSuit.NoTrump),
    respond1NTBranch,
    decision(
      "partner-opened-2nt-check",
      partnerOpenedAt(2, BidSuit.NoTrump),
      respond2NTBranch,
      decision(
        "partner-opened-2c-check",
        partnerOpenedAt(2, BidSuit.Clubs),
        respond2CBranch,
        decision(
          "partner-opened-weak2-check",
          or(
            partnerOpenedAt(2, BidSuit.Diamonds),
            partnerOpenedAt(2, BidSuit.Hearts),
            partnerOpenedAt(2, BidSuit.Spades),
          ),
          respondWeakTwoBranch,
          decision(
            "partner-opened-hearts-check",
            partnerOpened(BidSuit.Hearts),
            makeMajorRaiseBranch(
              handDecision(
                "respond-1s-over-1h",
                and(hcpMin(6), suitMin(0, "spades", 4)),
                intentBid("sayc-respond-1s-over-1h", "Responds showing 4+ spades",
                  { type: SemanticIntentType.ShowHeldSuit, params: { level: 1, strain: "S" } },
                  (): Call => ({ type: "bid", level: 1, strain: BidSuit.Spades })),
                makeRespond2Over1Branch(),
              ),
            ),
            decision(
              "partner-opened-major-check",
              partnerOpenedMajor(),
              makeMajorRaiseBranch(makeRespond2Over1Branch()),
              decision(
                "partner-opened-minor-check",
                partnerOpenedMinor(),
                handDecision(
                  "respond-1h-over-minor",
                  and(hcpMin(6), suitMin(1, "hearts", 4)),
                  intentBid("sayc-respond-1h-over-minor", "Responds showing 4+ hearts",
                    { type: SemanticIntentType.ShowHeldSuit, params: { level: 1, strain: "H" } },
                    (): Call => ({ type: "bid", level: 1, strain: BidSuit.Hearts })),
                  handDecision(
                    "respond-1s-over-minor",
                    and(hcpMin(6), suitMin(0, "spades", 4)),
                    intentBid("sayc-respond-1s-over-minor", "Responds showing 4+ spades",
                      { type: SemanticIntentType.ShowHeldSuit, params: { level: 1, strain: "S" } },
                      (): Call => ({ type: "bid", level: 1, strain: BidSuit.Spades })),
                    makeRespondNTBranch(),
                  ),
                ),
                saycPass(),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

// ─── Competitive bidding ────────────────────────────────────

function makeCompetitiveBranch(): RuleNode {
  // Gate: must not be opener or responder
  return decision(
    "not-opener-check",
    and(not(isOpener()), not(isResponder())),
    handDecision(
      "1nt-overcall",
      and(hcpRange(15, 18), isBalanced()),
      intentBid("sayc-1nt-overcall", "Overcalls showing a balanced hand",
        { type: SemanticIntentType.NaturalBid, params: { level: 1, strain: "NT" } },
        (): Call => ({ type: "bid", level: 1, strain: BidSuit.NoTrump })),
      handDecision(
        "overcall-1level",
        and(hcpRange(8, 16), goodSuitAtLevel(1)),
        intentBid("sayc-overcall-1level", "Overcalls showing a good suit",
          { type: SemanticIntentType.NaturalBid, params: { level: 1 } },
          overcall1LevelCall),
        handDecision(
          "overcall-2level",
          and(hcpRange(10, 16), goodSuitAtLevel(2)),
          intentBid("sayc-overcall-2level", "Overcalls showing a good suit",
            { type: SemanticIntentType.NaturalBid, params: { level: 2 } },
            overcall2LevelCall),
          saycPass(),
        ),
      ),
    ),
    saycPass(),
  );
}

// ─── Opener rebids ──────────────────────────────────────────

function makeOpenerNonRaiseRebidBranch(): HandNode {
  return handDecision(
    "rebid-raise-partner",
    and(hcpRange(12, 16), partnerRespondedMajorWithSupport()),
    intentBid("sayc-rebid-raise-partner-major", "Raises partner's major suit response",
      { type: SemanticIntentType.ShowSupport, params: { level: 2 } },
      rebidRaisePartnerMajorCall),
    handDecision(
      "rebid-own-suit",
      and(hcpRange(12, 17), sixPlusInOpenedSuit()),
      intentBid("sayc-rebid-own-suit", "Rebids showing a 6+ card suit",
        { type: SemanticIntentType.NaturalBid, params: {} },
        rebidOwnSuitCall),
      handDecision(
        "rebid-1nt",
        and(hcpRange(12, 14), isBalanced()),
        intentBid("sayc-rebid-1nt", "Rebids notrump showing a balanced hand",
          { type: SemanticIntentType.NaturalBid, params: { level: 1, strain: "NT" } },
          (): Call => ({ type: "bid", level: 1, strain: BidSuit.NoTrump })),
        handDecision(
          "rebid-2nt",
          and(hcpRange(18, 19), isBalanced()),
          intentBid("sayc-rebid-2nt", "Rebids notrump showing extra values",
            { type: SemanticIntentType.NaturalBid, params: { level: 2, strain: "NT" } },
            (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
          saycPass(),
        ),
      ),
    ),
  );
}

function makeOpenerRebidBranch(): HandNode {
  return handDecision(
    "rebid-4m-after-raise",
    and(hcpMin(19), partnerRaisedOurMajor()),
    intentBid("sayc-rebid-4m-after-raise", "Jumps to game in the raised major",
      { type: SemanticIntentType.ForceGame, params: {} },
      rebid4mAfterRaiseCall),
    handDecision(
      "rebid-3m-invite",
      and(hcpRange(17, 18), partnerRaisedOurMajor()),
      intentBid("sayc-rebid-3m-invite", "Invites game in the raised major",
        { type: SemanticIntentType.InviteGame, params: {} },
        rebid3mInviteCall),
      handDecision(
        "rebid-pass-raise",
        and(hcpRange(12, 16), partnerRaisedOurMajor()),
        intentBid("sayc-rebid-pass-after-raise", "Accepts partner's raise",
          { type: SemanticIntentType.Signoff, params: {} },
          (): Call => ({ type: "pass" })),
        makeOpenerNonRaiseRebidBranch(),
      ),
    ),
  );
}

function makeOpenerTransferOrRebid(): RuleNode {
  // Check transfer accept first, then general rebid
  return decision(
    "opener-1nt-transfer-check",
    auctionMatchesAny([
      ["1NT", "P", "2D", "P"],
      ["1NT", "P", "2H", "P"],
    ]),
    intentBid("sayc-opener-accept-transfer", "Completes the Jacoby transfer",
      { type: SemanticIntentType.AcceptTransfer, params: {} },
      openerAcceptTransferCall),
    makeOpenerRebidBranch(),
  );
}

// ─── Hand tree dispatch ──────────────────────────────────────

const handTreeMap: Record<string, RuleNode> = {
  "is-opener-no-prior-bid": openingBranch,
  "is-responder": makeResponderHandTree(),
  "opponent-bid": makeCompetitiveBranch(),
  "is-opener-rebid": makeOpenerTransferOrRebid(),
  "default": saycPass(),
};

function resolveHandTree(est: SAYCEstablished): HandNode {
  return (handTreeMap[est.slotName] ?? saycPass()) as HandNode;
}

// ─── Protocol ────────────────────────────────────────────────

// Slot ordering is semantically significant — first-match-wins:
// 1. isOpener() && noPriorBid() before isOpener() && seatHasBid()
// 2. isResponder() before opponentBid()
export const saycProtocol: ConventionProtocol<SAYCEstablished> = protocol<SAYCEstablished>("sayc", [
  round<SAYCEstablished>("dispatch", {
    triggers: [
      semantic<SAYCEstablished>(
        and(isOpener(), noPriorBid()) as AuctionCondition,
        { slotName: "is-opener-no-prior-bid" },
      ),
      semantic<SAYCEstablished>(
        isResponder(),
        { slotName: "is-responder" },
      ),
      semantic<SAYCEstablished>(
        opponentBid(),
        { slotName: "opponent-bid" },
      ),
      semantic<SAYCEstablished>(
        and(isOpener(), seatHasBid()) as AuctionCondition,
        { slotName: "is-opener-rebid" },
      ),
    ],
    handTree: resolveHandTree,
  }),
]);
