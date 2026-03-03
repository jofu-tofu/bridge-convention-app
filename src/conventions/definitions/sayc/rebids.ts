import type { Call } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";
import {
  hcpMin,
  hcpRange,
  isBalanced,
  and,
  partnerRaisedOurMajor,
  partnerRespondedMajorWithSupport,
  sixPlusInOpenedSuit,
  auctionMatchesAny,
} from "../../core/conditions";
import { decision, handDecision } from "../../core/rule-tree";
import type { HandNode, RuleNode } from "../../core/rule-tree";
import { intentBid } from "../../core/intent/intent-node";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import {
  rebid4mAfterRaiseCall,
  rebid3mInviteCall,
  rebidRaisePartnerMajorCall,
  rebidOwnSuitCall,
  openerAcceptTransferCall,
  saycPass,
} from "./helpers";

// ─── Opener rebids ──────────────────────────────────────────

export function makeOpenerNonRaiseRebidBranch(): HandNode {
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

export function makeOpenerRebidBranch(): HandNode {
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

export function makeOpenerTransferOrRebid(): RuleNode {
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

