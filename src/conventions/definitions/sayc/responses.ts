import type { Call } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";
import {
  hcpMin,
  hcpRange,
  suitMin,
  isBalanced,
  hasFourCardMajor,
  partnerOpenedAt,
  partnerOpened,
  partnerOpenedMajor,
  partnerOpenedMinor,
  majorSupportN,
  isOpener,
  isResponder,
  not,
  and,
  or,
  goodSuitAtLevel,
} from "../../core/conditions";
import { decision, handDecision } from "../../core/tree/rule-tree";
import type { HandNode, RuleNode } from "../../core/tree/rule-tree";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import {
  saycBid,
  respondRaiseMajorCall,
  respondJumpRaiseMajorCall,
  respondGameRaiseMajorCall,
  respondWeakRaiseCall,
  overcall1LevelCall,
  overcall2LevelCall,
  saycPass,
} from "./helpers";

// ─── Responses to 1NT opening ───────────────────────────────

export const respond1NTBranch: HandNode = handDecision(
  "transfer-5+hearts",
  suitMin(1, "hearts", 5),
  saycBid("sayc-respond-1nt-transfer-hearts", "Transfers to hearts showing 5+ hearts",
    { type: SemanticIntentType.TransferTo, params: { strain: "H" } },
    (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds })),
  handDecision(
    "transfer-5+spades",
    suitMin(0, "spades", 5),
    saycBid("sayc-respond-1nt-transfer-spades", "Transfers to spades showing 5+ spades",
      { type: SemanticIntentType.TransferTo, params: { strain: "S" } },
      (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
    handDecision(
      "8+-with-4M",
      and(hcpMin(8), hasFourCardMajor()),
      saycBid("sayc-respond-1nt-stayman", "Asks opener for a 4-card major",
        { type: SemanticIntentType.AskForMajor, params: {} },
        (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
      handDecision(
        "10-15-balanced-3nt",
        and(hcpRange(10, 15), isBalanced()),
        saycBid("sayc-respond-1nt-3nt", "Raises to game in notrump",
          { type: SemanticIntentType.ForceGame, params: { level: 3, strain: "NT" } },
          (): Call => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
        handDecision(
          "8-9-balanced-invite",
          and(hcpRange(8, 9), isBalanced()),
          saycBid("sayc-respond-1nt-2nt", "Invites game in notrump",
            { type: SemanticIntentType.InviteGame, params: { level: 2, strain: "NT" } },
            (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
          handDecision(
            "0-7-hcp",
            hcpRange(0, 7),
            saycBid("sayc-respond-1nt-pass", "Declines to respond to the notrump opening",
              { type: SemanticIntentType.Signoff, params: {} },
              (): Call => ({ type: "pass" })),
            saycPass("respond-1nt-fallback"),
          ),
        ),
      ),
    ),
  ),
);

// ─── Responses to 2NT opening ───────────────────────────────

export const respond2NTBranch: HandNode = handDecision(
  "resp-2nt-transfer-5+hearts",
  and(hcpMin(4), suitMin(1, "hearts", 5)),
  saycBid("sayc-respond-2nt-transfer-hearts", "Transfers to hearts showing 5+ hearts",
    { type: SemanticIntentType.TransferTo, params: { strain: "H" } },
    (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
  handDecision(
    "resp-2nt-transfer-5+spades",
    and(hcpMin(4), suitMin(0, "spades", 5)),
    saycBid("sayc-respond-2nt-transfer-spades", "Transfers to spades showing 5+ spades",
      { type: SemanticIntentType.TransferTo, params: { strain: "S" } },
      (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts })),
    handDecision(
      "resp-2nt-stayman",
      and(hcpMin(4), hasFourCardMajor()),
      saycBid("sayc-respond-2nt-stayman", "Asks opener for a 4-card major",
        { type: SemanticIntentType.AskForMajor, params: {} },
        (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
      handDecision(
        "resp-2nt-3nt",
        and(hcpRange(4, 10), isBalanced()),
        saycBid("sayc-respond-2nt-3nt", "Raises to game in notrump",
          { type: SemanticIntentType.ForceGame, params: { level: 3, strain: "NT" } },
          (): Call => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
        handDecision(
          "resp-2nt-pass",
          hcpRange(0, 3),
          saycBid("sayc-respond-2nt-pass", "Declines to respond with a weak hand",
            { type: SemanticIntentType.Signoff, params: {} },
            (): Call => ({ type: "pass" })),
          saycPass("respond-2nt-fallback"),
        ),
      ),
    ),
  ),
);

// ─── Responses to strong 2C opening ─────────────────────────

export const respond2CBranch: HandNode = handDecision(
  "resp-2c-positive-spades",
  and(hcpMin(8), suitMin(0, "spades", 5)),
  saycBid("sayc-respond-2c-positive-spades", "Shows a positive response with 5+ spades",
    { type: SemanticIntentType.ForceGame, params: { level: 2, strain: "S" } },
    (): Call => ({ type: "bid", level: 2, strain: BidSuit.Spades })),
  handDecision(
    "resp-2c-positive-hearts",
    and(hcpMin(8), suitMin(1, "hearts", 5)),
    saycBid("sayc-respond-2c-positive-hearts", "Shows a positive response with 5+ hearts",
      { type: SemanticIntentType.ForceGame, params: { level: 2, strain: "H" } },
      (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
    handDecision(
      "resp-2c-positive-diamonds",
      and(hcpMin(8), suitMin(2, "diamonds", 5)),
      saycBid("sayc-respond-2c-positive-diamonds", "Shows a positive response with 5+ diamonds",
        { type: SemanticIntentType.ForceGame, params: { level: 3, strain: "D" } },
        (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
      handDecision(
        "resp-2c-positive-clubs",
        and(hcpMin(8), suitMin(3, "clubs", 5)),
        saycBid("sayc-respond-2c-positive-clubs", "Shows a positive response with 5+ clubs",
          { type: SemanticIntentType.ForceGame, params: { level: 3, strain: "C" } },
          (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
        handDecision(
          "resp-2c-positive-2nt",
          and(hcpMin(8), isBalanced()),
          saycBid("sayc-respond-2c-2nt", "Shows a positive balanced hand",
            { type: SemanticIntentType.ForceGame, params: { level: 2, strain: "NT" } },
            (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
          saycBid("sayc-respond-2c-2d-waiting", "Responds with an artificial waiting bid",
            { type: SemanticIntentType.NaturalBid, params: { level: 2, strain: "D" } },
            (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds })),
        ),
      ),
    ),
  ),
);

// ─── Responses to weak two bids ─────────────────────────────

export const respondWeakTwoBranch: HandNode = handDecision(
  "resp-weak2-2nt-feature",
  hcpMin(16),
  saycBid("sayc-respond-weak2-2nt", "Asks opener to describe hand further",
    { type: SemanticIntentType.AskHandQuality, params: {} },
    (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
  handDecision(
    "resp-weak2-raise",
    and(hcpRange(6, 15), majorSupportN(3)),
    saycBid("sayc-respond-weak2-raise", "Raises partner's weak two bid",
      { type: SemanticIntentType.ShowSupport, params: { level: 3 } },
      respondWeakRaiseCall),
    saycPass("respond-weak2-fallback"),
  ),
);

// ─── Responses to suit openings ─────────────────────────────

export function makeRespondNTBranch(ctx: string): HandNode {
  return handDecision(
    "respond-1nt-6-10",
    hcpRange(6, 10),
    saycBid(`sayc-respond-1nt-${ctx}`, "Responds showing a balanced hand",
      { type: SemanticIntentType.NaturalBid, params: { level: 1, strain: "NT" } },
      (): Call => ({ type: "bid", level: 1, strain: BidSuit.NoTrump })),
    handDecision(
      "respond-2nt-13-15",
      and(hcpRange(13, 15), isBalanced()),
      saycBid(`sayc-respond-2nt-${ctx}`, "Shows an invitational balanced hand",
        { type: SemanticIntentType.InviteGame, params: { level: 2, strain: "NT" } },
        (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
      handDecision(
        "respond-3nt-16-18",
        and(hcpRange(16, 18), isBalanced()),
        saycBid(`sayc-respond-3nt-${ctx}`, "Shows a game-forcing balanced hand",
          { type: SemanticIntentType.ForceGame, params: { level: 3, strain: "NT" } },
          (): Call => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
        saycPass(`respond-nt-${ctx}`),
      ),
    ),
  );
}

export function makeRespond2Over1Branch(ctx: string): HandNode {
  return handDecision(
    "respond-2c-over-major",
    and(hcpMin(10), suitMin(3, "clubs", 4)),
    saycBid(`sayc-respond-2c-over-major-${ctx}`, "Responds in a new suit, forcing",
      { type: SemanticIntentType.ShowHeldSuit, params: { level: 2, strain: "C" } },
      (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
    handDecision(
      "respond-2d-over-major",
      and(hcpMin(10), suitMin(2, "diamonds", 4)),
      saycBid(`sayc-respond-2d-over-major-${ctx}`, "Responds in a new suit, forcing",
        { type: SemanticIntentType.ShowHeldSuit, params: { level: 2, strain: "D" } },
        (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds })),
      makeRespondNTBranch(`2o1-${ctx}`),
    ),
  );
}

export function makeMajorRaiseBranch(noRaiseFallback: HandNode, ctx: string): HandNode {
  return handDecision(
    "game-raise-13+",
    and(hcpMin(13), majorSupportN(4)),
    saycBid(`sayc-respond-game-raise-major-${ctx}`, "Raises partner's major directly to game",
      { type: SemanticIntentType.ForceGame, params: {} },
      respondGameRaiseMajorCall),
    handDecision(
      "jump-raise-10-12",
      and(hcpRange(10, 12), majorSupportN(4)),
      saycBid(`sayc-respond-jump-raise-major-${ctx}`, "Makes a limit raise in partner's major",
        { type: SemanticIntentType.ShowSupport, params: { level: 3 } },
        respondJumpRaiseMajorCall),
      handDecision(
        "simple-raise-6-10",
        and(hcpRange(6, 10), majorSupportN(3)),
        saycBid(`sayc-respond-raise-major-${ctx}`, "Makes a simple raise in partner's major",
          { type: SemanticIntentType.ShowSupport, params: { level: 2 } },
          respondRaiseMajorCall),
        noRaiseFallback,
      ),
    ),
  );
}

// ─── Responder dispatch via hand tree ───────────────────────

export function makeResponderHandTree(): RuleNode {
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
                saycBid("sayc-respond-1s-over-1h", "Responds showing 4+ spades",
                  { type: SemanticIntentType.ShowHeldSuit, params: { level: 1, strain: "S" } },
                  (): Call => ({ type: "bid", level: 1, strain: BidSuit.Spades })),
                makeRespond2Over1Branch("over-h"),
              ),
              "over-h",
            ),
            decision(
              "partner-opened-major-check",
              partnerOpenedMajor(),
              makeMajorRaiseBranch(makeRespond2Over1Branch("over-s"), "over-s"),
              decision(
                "partner-opened-minor-check",
                partnerOpenedMinor(),
                handDecision(
                  "respond-1h-over-minor",
                  and(hcpMin(6), suitMin(1, "hearts", 4)),
                  saycBid("sayc-respond-1h-over-minor", "Responds showing 4+ hearts",
                    { type: SemanticIntentType.ShowHeldSuit, params: { level: 1, strain: "H" } },
                    (): Call => ({ type: "bid", level: 1, strain: BidSuit.Hearts })),
                  handDecision(
                    "respond-1s-over-minor",
                    and(hcpMin(6), suitMin(0, "spades", 4)),
                    saycBid("sayc-respond-1s-over-minor", "Responds showing 4+ spades",
                      { type: SemanticIntentType.ShowHeldSuit, params: { level: 1, strain: "S" } },
                      (): Call => ({ type: "bid", level: 1, strain: BidSuit.Spades })),
                    makeRespondNTBranch("over-m"),
                  ),
                ),
                saycPass("no-partner-opening"),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

// ─── Competitive bidding ────────────────────────────────────

export function makeCompetitiveBranch(): RuleNode {
  // Gate: must not be opener or responder
  return decision(
    "not-opener-check",
    and(not(isOpener()), not(isResponder())),
    handDecision(
      "1nt-overcall",
      and(hcpRange(15, 18), isBalanced()),
      saycBid("sayc-1nt-overcall", "Overcalls showing a balanced hand",
        { type: SemanticIntentType.NaturalBid, params: { level: 1, strain: "NT" } },
        (): Call => ({ type: "bid", level: 1, strain: BidSuit.NoTrump })),
      handDecision(
        "overcall-1level",
        and(hcpRange(8, 16), goodSuitAtLevel(1)),
        saycBid("sayc-overcall-1level", "Overcalls showing a good suit",
          { type: SemanticIntentType.NaturalBid, params: { level: 1 } },
          overcall1LevelCall),
        handDecision(
          "overcall-2level",
          and(hcpRange(10, 16), goodSuitAtLevel(2)),
          saycBid("sayc-overcall-2level", "Overcalls showing a good suit",
            { type: SemanticIntentType.NaturalBid, params: { level: 2 } },
            overcall2LevelCall),
          saycPass("no-overcall"),
        ),
      ),
    ),
    saycPass("not-competitive"),
  );
}
