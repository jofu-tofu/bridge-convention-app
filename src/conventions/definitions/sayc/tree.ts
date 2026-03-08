import {
  isOpener,
  isResponder,
  opponentBid,
  noPriorBid,
  seatHasBid,
  and,
} from "../../core/conditions";
import type { HandNode, RuleNode } from "../../core/rule-tree";
import { protocol, round, semantic } from "../../core/protocol";
import type { ConventionProtocol, EstablishedContext } from "../../core/protocol";
import { saycPass } from "./helpers";
import { openingBranch } from "./openings";
import { makeResponderHandTree, makeCompetitiveBranch } from "./responses";
import { makeOpenerTransferOrRebid } from "./rebids";

// ─── Established context ────────────────────────────────────

interface SAYCEstablished extends EstablishedContext {
  slotName: string;
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
        and(isOpener(), noPriorBid()),
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
        and(isOpener(), seatHasBid()),
        { slotName: "is-opener-rebid" },
      ),
    ],
    handTree: resolveHandTree,
  }),
]);
