import { ConventionCategory } from "./types";
import type { BiddingContext } from "./types";
import type { Call, ContractBid } from "../engine/types";
import { BidSuit } from "../engine/types";
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
  hasFourCardMajor,
  partnerOpenedMajor,
  partnerOpenedMinor,
  majorSupportN,
  partnerRaisedOurMajor,
  partnerRespondedMajorWithSupport,
  sixPlusInOpenedSuit,
  goodSuitAtLevel,
  partnerOpeningStrain,
  seatFirstBidStrain,
  partnerRespondedMajor,
  lastBid,
  bidIsHigher,
} from "./conditions";
import { decision, bid } from "./rule-tree";
import type { RuleNode, TreeConventionConfig } from "./rule-tree";


// ─── Helpers ─────────────────────────────────────────────────

const pass: Call = { type: "pass" };

function makeBid(
  level: ContractBid["level"],
  strain: BidSuit,
): Call {
  return { type: "bid", level, strain };
}

// ─── Dynamic call functions ─────────────────────────────────

function respondRaiseMajorCall(ctx: BiddingContext): Call {
  const strain = partnerOpeningStrain(ctx);
  if (!strain) return pass;
  return makeBid(2, strain);
}

function respondJumpRaiseMajorCall(ctx: BiddingContext): Call {
  const strain = partnerOpeningStrain(ctx);
  if (!strain) return pass;
  return makeBid(3, strain);
}

function respondGameRaiseMajorCall(ctx: BiddingContext): Call {
  const strain = partnerOpeningStrain(ctx);
  if (!strain) return pass;
  return makeBid(4, strain);
}

function rebid4mAfterRaiseCall(ctx: BiddingContext): Call {
  const strain = seatFirstBidStrain(ctx);
  if (!strain) return pass;
  return makeBid(4, strain);
}

function rebid3mInviteCall(ctx: BiddingContext): Call {
  const strain = seatFirstBidStrain(ctx);
  if (!strain) return pass;
  return makeBid(3, strain);
}

function rebidRaisePartnerMajorCall(ctx: BiddingContext): Call {
  const partnerMajor = partnerRespondedMajor(ctx);
  if (!partnerMajor) return pass;
  return makeBid(2, partnerMajor);
}

function rebidOwnSuitCall(ctx: BiddingContext): Call {
  const strain = seatFirstBidStrain(ctx);
  if (!strain) return pass;
  return makeBid(2, strain);
}

function findBestOvercallSuit(
  ctx: BiddingContext,
  level: 1 | 2,
): Call {
  const lb = lastBid(ctx);
  if (!lb) return pass;
  const suitStrains: BidSuit[] = [
    BidSuit.Spades,
    BidSuit.Hearts,
    BidSuit.Diamonds,
    BidSuit.Clubs,
  ];
  let bestIdx = -1;
  let bestLen = 0;
  for (let i = 0; i < 4; i++) {
    const len = ctx.evaluation.shape[i]!;
    if (
      len >= 5 &&
      bidIsHigher(level, suitStrains[i]!, lb) &&
      len > bestLen
    ) {
      bestLen = len;
      bestIdx = i;
    }
  }
  if (bestIdx === -1) return pass;
  return makeBid(level, suitStrains[bestIdx]!);
}

function overcall1LevelCall(ctx: BiddingContext): Call {
  return findBestOvercallSuit(ctx, 1);
}

function overcall2LevelCall(ctx: BiddingContext): Call {
  return findBestOvercallSuit(ctx, 2);
}

// ─── Named subtrees ─────────────────────────────────────────

// SAYC catch-all: every terminal in SAYC produces Pass (not fallback/null)
// because SAYC is a catch-all convention — any hand that enters produces a bid or pass.
const saycPass = (): RuleNode => bid("sayc-pass", (): Call => pass);

const weakOpeningBranch: RuleNode = decision(
  "weak-6hearts",
  and(hcpRange(5, 11), suitMin(1, "hearts", 6)),
  bid("sayc-open-weak-2h", (): Call => makeBid(2, BidSuit.Hearts)),
  decision(
    "weak-6spades",
    and(hcpRange(5, 11), suitMin(0, "spades", 6)),
    bid("sayc-open-weak-2s", (): Call => makeBid(2, BidSuit.Spades)),
    decision(
      "weak-6diamonds",
      and(hcpRange(5, 11), suitMin(2, "diamonds", 6)),
      bid("sayc-open-weak-2d", (): Call => makeBid(2, BidSuit.Diamonds)),
      saycPass(),
    ),
  ),
);

// Minor-suit opening subtree (no 5-card major)
const openMinorBranch: RuleNode = decision(
  "12+-4diamonds",
  and(hcpMin(12), suitBelow(0, "spades", 5), suitBelow(1, "hearts", 5), suitMin(2, "diamonds", 4)),
  bid("sayc-open-1d", (): Call => makeBid(1, BidSuit.Diamonds)),
  decision(
    "12+-3clubs",
    and(hcpMin(12), suitBelow(0, "spades", 5), suitBelow(1, "hearts", 5), suitMin(3, "clubs", 3)),
    bid("sayc-open-1c", (): Call => makeBid(1, BidSuit.Clubs)),
    weakOpeningBranch,
  ),
);

// Major-suit opening subtree (12+ HCP)
const openMajorBranch: RuleNode = decision(
  "12+-longer-spades",
  and(hcpMin(12), longerMajor(0, "spades")),
  bid("sayc-open-1s", (): Call => makeBid(1, BidSuit.Spades)),
  decision(
    "12+-5hearts",
    and(hcpMin(12), suitMin(1, "hearts", 5)),
    bid("sayc-open-1h", (): Call => makeBid(1, BidSuit.Hearts)),
    openMinorBranch,
  ),
);

const openingBranch: RuleNode = decision(
  "hcp-22+",
  hcpMin(22),
  bid("sayc-open-2c", (): Call => makeBid(2, BidSuit.Clubs)),
  decision(
    "hcp-20-21-balanced",
    and(hcpRange(20, 21), isBalanced()),
    bid("sayc-open-2nt", (): Call => makeBid(2, BidSuit.NoTrump)),
    decision(
      "hcp-15-17-bal-no5M",
      and(hcpRange(15, 17), isBalanced(), noFiveCardMajor()),
      bid("sayc-open-1nt", (): Call => makeBid(1, BidSuit.NoTrump)),
      openMajorBranch,
    ),
  ),
);

const respond1NTBranch: RuleNode = decision(
  "8+-with-4M",
  and(hcpMin(8), hasFourCardMajor()),
  bid("sayc-respond-1nt-stayman", (): Call => makeBid(2, BidSuit.Clubs)),
  decision(
    "0-7-hcp",
    hcpRange(0, 7),
    bid("sayc-respond-1nt-pass", (): Call => pass),
    saycPass(),
  ),
);


const respondNTBranch: RuleNode = decision(
  "respond-not-nt-opening",
  not(partnerOpened(BidSuit.NoTrump)),
  decision(
    "respond-1nt-6-10",
    hcpRange(6, 10),
    bid("sayc-respond-1nt", (): Call => makeBid(1, BidSuit.NoTrump)),
    decision(
      "respond-2nt-13-15",
      and(hcpRange(13, 15), isBalanced()),
      bid("sayc-respond-2nt", (): Call => makeBid(2, BidSuit.NoTrump)),
      decision(
        "respond-3nt-16-18",
        and(hcpRange(16, 18), isBalanced()),
        bid("sayc-respond-3nt", (): Call => makeBid(3, BidSuit.NoTrump)),
        saycPass(),
      ),
    ),
  ),
  saycPass(),
);

// New suit responses (no major support or raise available)
const respondNewSuitBranch: RuleNode = decision(
  "respond-1h-over-minor",
  and(hcpMin(6), suitMin(1, "hearts", 4), partnerOpenedMinor()),
  bid("sayc-respond-1h-over-minor", (): Call => makeBid(1, BidSuit.Hearts)),
  decision(
    "respond-1s-over-minor",
    and(hcpMin(6), suitMin(0, "spades", 4), partnerOpenedMinor()),
    bid("sayc-respond-1s-over-minor", (): Call => makeBid(1, BidSuit.Spades)),
    decision(
      "respond-1s-over-1h",
      and(hcpMin(6), suitMin(0, "spades", 4), partnerOpened(BidSuit.Hearts)),
      bid("sayc-respond-1s-over-1h", (): Call => makeBid(1, BidSuit.Spades)),
      decision(
        "respond-2c-over-major",
        and(hcpMin(12), suitMin(3, "clubs", 4), partnerOpenedMajor()),
        bid("sayc-respond-2c-over-major", (): Call => makeBid(2, BidSuit.Clubs)),
        decision(
          "respond-2d-over-major",
          and(hcpMin(12), suitMin(2, "diamonds", 4), partnerOpenedMajor()),
          bid("sayc-respond-2d-over-major", (): Call => makeBid(2, BidSuit.Diamonds)),
          respondNTBranch,
        ),
      ),
    ),
  ),
);

// Suit response branch: try major raises first (they implicitly check partner opened
// a major via majorSupportN), then fall through to other response types. No top-level
// split on partnerOpenedMajor — that would trap hands without support.
const respondSuitBranch: RuleNode = decision(
  "game-raise-13+",
  and(hcpMin(13), majorSupportN(4)),
  bid("sayc-respond-game-raise-major", respondGameRaiseMajorCall),
  decision(
    "jump-raise-10-12",
    and(hcpRange(10, 12), majorSupportN(4)),
    bid("sayc-respond-jump-raise-major", respondJumpRaiseMajorCall),
    decision(
      "simple-raise-6-10",
      and(hcpRange(6, 10), majorSupportN(3)),
      bid("sayc-respond-raise-major", respondRaiseMajorCall),
      respondNewSuitBranch,
    ),
  ),
);

const competitiveBranch: RuleNode = decision(
  "1nt-overcall",
  and(not(isOpener()), not(isResponder()), hcpRange(15, 18), isBalanced()),
  bid("sayc-1nt-overcall", (): Call => makeBid(1, BidSuit.NoTrump)),
  decision(
    "overcall-1level",
    and(hcpRange(8, 16), goodSuitAtLevel(1)),
    bid("sayc-overcall-1level", overcall1LevelCall),
    decision(
      "overcall-2level",
      and(hcpRange(10, 16), goodSuitAtLevel(2)),
      bid("sayc-overcall-2level", overcall2LevelCall),
      saycPass(),
    ),
  ),
);

// Non-raise rebids (partner did not raise our major)
const openerNonRaiseRebidBranch: RuleNode = decision(
  "rebid-raise-partner",
  and(hcpRange(12, 16), partnerRespondedMajorWithSupport()),
  bid("sayc-rebid-raise-partner-major", rebidRaisePartnerMajorCall),
  decision(
    "rebid-own-suit",
    and(hcpRange(12, 17), sixPlusInOpenedSuit()),
    bid("sayc-rebid-own-suit", rebidOwnSuitCall),
    decision(
      "rebid-1nt",
      and(hcpRange(12, 14), isBalanced()),
      bid("sayc-rebid-1nt", (): Call => makeBid(1, BidSuit.NoTrump)),
      decision(
        "rebid-2nt",
        and(hcpRange(18, 19), isBalanced()),
        bid("sayc-rebid-2nt", (): Call => makeBid(2, BidSuit.NoTrump)),
        saycPass(),
      ),
    ),
  ),
);

const openerRebidBranch: RuleNode = decision(
  "rebid-4m-after-raise",
  and(hcpMin(19), partnerRaisedOurMajor()),
  bid("sayc-rebid-4m-after-raise", rebid4mAfterRaiseCall),
  decision(
    "rebid-3m-invite",
    and(hcpRange(17, 18), partnerRaisedOurMajor()),
    bid("sayc-rebid-3m-invite", rebid3mInviteCall),
    decision(
      "rebid-pass-raise",
      and(hcpRange(12, 16), partnerRaisedOurMajor()),
      bid("sayc-rebid-pass-after-raise", (): Call => pass),
      openerNonRaiseRebidBranch,
    ),
  ),
);

// ─── Root tree ──────────────────────────────────────────────

const saycRuleTree: RuleNode = decision(
  "is-opener-no-prior-bid",
  and(isOpener(), noPriorBid()),
  openingBranch,
  decision(
    "is-responder",
    isResponder(),
    decision(
      "partner-opened-1nt-resp",
      partnerOpenedAt(1, BidSuit.NoTrump),
      respond1NTBranch,
      respondSuitBranch,
    ),
    decision(
      "opponent-bid",
      opponentBid(),
      competitiveBranch,
      decision(
        "is-opener-rebid",
        and(isOpener(), seatHasBid()),
        openerRebidBranch,
        bid("sayc-pass", (): Call => pass),
      ),
    ),
  ),
);

// ─── SAYC Convention ─────────────────────────────────────────

export const saycConfig: TreeConventionConfig = {
  id: "sayc",
  name: "Standard American Yellow Card",
  description: "Standard American bidding system for opponent AI",
  category: ConventionCategory.Constructive,
  internal: true,
  dealConstraints: {
    seats: [], // No specific constraints — SAYC works with any hand
  },
  defaultAuction: () => undefined,
  ruleTree: saycRuleTree,
  examples: [], // No examples needed for internal convention
};
