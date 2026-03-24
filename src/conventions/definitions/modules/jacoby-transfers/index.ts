import type { BidMeaning } from "../../../pipeline/meaning";
import type { LocalFsm, StateEntry } from "../../../core/rule-module";
import type { ConventionModule } from "../../../core/convention-module";
import type { NegotiationDelta } from "../../../core/committed-step";
import type { SystemConfig } from "../../system-config";

import { createTransferFacts } from "./facts";
import { TRANSFER_EXPLANATION_ENTRIES } from "./explanation-catalog";
import {
  TRANSFER_R1_SURFACES,
  OPENER_TRANSFER_HEARTS_SURFACES,
  OPENER_TRANSFER_SPADES_SURFACES,
  createTransferR3HeartsSurfaces,
  createTransferR3SpadesSurfaces,
  OPENER_PLACE_HEARTS_SURFACES,
  OPENER_PLACE_SPADES_SURFACES,
  createOpenerAcceptInviteHeartsSurfaces,
  createOpenerAcceptInviteSpadesSurfaces,
  createOpenerAcceptInviteRaiseHeartsSurfaces,
  createOpenerAcceptInviteRaiseSpadesSurfaces,
} from "./meaning-surfaces";

export { TRANSFER_CLASSES, TRANSFER_R3_CLASSES, OPENER_PLACE_CLASSES } from "./semantic-classes";
export { createTransferFacts } from "./facts";
export {
  TRANSFER_R1_SURFACES,
  OPENER_TRANSFER_HEARTS_SURFACES,
  OPENER_TRANSFER_SPADES_SURFACES,
  OPENER_PLACE_HEARTS_SURFACES,
  OPENER_PLACE_SPADES_SURFACES,
} from "./meaning-surfaces";

// ─── Local FSM + States ──────────────────────────────────────────────

type TransferPhase = "idle" | "inactive" | "transferred-hearts" | "transferred-spades"
  | "accepted-hearts" | "accepted-spades" | "placing-hearts" | "placing-spades"
  | "invited-hearts" | "invited-spades" | "invite-raised-hearts" | "invite-raised-spades";

const TRANSFER_BID_DELTA: NegotiationDelta = { forcing: "one-round", captain: "responder" };
const ACCEPT_HEARTS_DELTA: NegotiationDelta = { forcing: "none", fitAgreed: { strain: "hearts", confidence: "tentative" } };
const ACCEPT_SPADES_DELTA: NegotiationDelta = { forcing: "none", fitAgreed: { strain: "spades", confidence: "tentative" } };
const CAPTAIN_TO_OPENER_DELTA: NegotiationDelta = { captain: "opener" };

export const jacobyTransfersLocal: LocalFsm<TransferPhase> = {
  initial: "idle",
  transitions: [
    { from: "idle", to: "transferred-hearts", on: { act: "transfer", suit: "hearts" } },
    { from: "idle", to: "transferred-spades", on: { act: "transfer", suit: "spades" } },
    { from: "idle", to: "inactive", on: { act: "inquire" } },
    { from: "idle", to: "inactive", on: { act: "raise" } },
    { from: "idle", to: "inactive", on: { act: "place" } },
    { from: "idle", to: "inactive", on: { act: "signoff" } },
    { from: "transferred-hearts", to: "accepted-hearts", on: { act: "accept", feature: "heldSuit", suit: "hearts" } },
    { from: "transferred-spades", to: "accepted-spades", on: { act: "accept", feature: "heldSuit", suit: "spades" } },
    { from: "accepted-hearts", to: "placing-hearts", on: { act: "place", strain: "notrump" } },
    { from: "accepted-spades", to: "placing-spades", on: { act: "place", strain: "notrump" } },
    { from: "accepted-hearts", to: "invite-raised-hearts", on: { act: "raise", strength: "invitational", feature: "heldSuit" } },
    { from: "accepted-spades", to: "invite-raised-spades", on: { act: "raise", strength: "invitational", feature: "heldSuit" } },
    { from: "accepted-hearts", to: "invited-hearts", on: { act: "raise", strength: "invitational" } },
    { from: "accepted-spades", to: "invited-spades", on: { act: "raise", strength: "invitational" } },
  ],
};

/** Split R3 surfaces by whether they transfer captaincy. */
function splitR3(surfaces: readonly BidMeaning[]): { captainTransfer: BidMeaning[]; terminal: BidMeaning[] } {
  const captainTransfer: BidMeaning[] = [];
  const terminal: BidMeaning[] = [];
  for (const s of surfaces) {
    if (s.sourceIntent.type === "TransferNTGame" || s.sourceIntent.type === "Invite") captainTransfer.push(s);
    else terminal.push(s);
  }
  return { captainTransfer, terminal };
}

export function createJacobyTransfersStates(sys: SystemConfig): readonly StateEntry<TransferPhase>[] {
  const r3Hearts = createTransferR3HeartsSurfaces(sys);
  const r3Spades = createTransferR3SpadesSurfaces(sys);
  const r3H = splitR3(r3Hearts);
  const r3S = splitR3(r3Spades);

  const openerAcceptInviteHearts = createOpenerAcceptInviteHeartsSurfaces(sys);
  const openerAcceptInviteSpades = createOpenerAcceptInviteSpadesSurfaces(sys);
  const openerAcceptInviteRaiseHearts = createOpenerAcceptInviteRaiseHeartsSurfaces(sys);
  const openerAcceptInviteRaiseSpades = createOpenerAcceptInviteRaiseSpadesSurfaces(sys);

  return [
    { phase: "idle", turn: "responder" as const, negotiationDelta: TRANSFER_BID_DELTA, surfaces: TRANSFER_R1_SURFACES },
    { phase: "transferred-hearts", turn: "opener" as const, negotiationDelta: ACCEPT_HEARTS_DELTA, surfaces: OPENER_TRANSFER_HEARTS_SURFACES },
    { phase: "transferred-spades", turn: "opener" as const, negotiationDelta: ACCEPT_SPADES_DELTA, surfaces: OPENER_TRANSFER_SPADES_SURFACES },
    ...(r3H.captainTransfer.length > 0 ? [{ phase: "accepted-hearts" as const, turn: "responder" as const, negotiationDelta: CAPTAIN_TO_OPENER_DELTA, surfaces: r3H.captainTransfer }] : []),
    ...(r3H.terminal.length > 0 ? [{ phase: "accepted-hearts" as const, turn: "responder" as const, surfaces: r3H.terminal }] : []),
    ...(r3S.captainTransfer.length > 0 ? [{ phase: "accepted-spades" as const, turn: "responder" as const, negotiationDelta: CAPTAIN_TO_OPENER_DELTA, surfaces: r3S.captainTransfer }] : []),
    ...(r3S.terminal.length > 0 ? [{ phase: "accepted-spades" as const, turn: "responder" as const, surfaces: r3S.terminal }] : []),
    { phase: "placing-hearts", turn: "opener" as const, surfaces: OPENER_PLACE_HEARTS_SURFACES },
    { phase: "placing-spades", turn: "opener" as const, surfaces: OPENER_PLACE_SPADES_SURFACES },
    { phase: "invited-hearts", turn: "opener" as const, surfaces: openerAcceptInviteHearts },
    { phase: "invited-spades", turn: "opener" as const, surfaces: openerAcceptInviteSpades },
    { phase: "invite-raised-hearts", turn: "opener" as const, surfaces: openerAcceptInviteRaiseHearts },
    { phase: "invite-raised-spades", turn: "opener" as const, surfaces: openerAcceptInviteRaiseSpades },
  ];
}

// ─── Module declarations ─────────────────────────────────────────────

/** Factory: creates jacoby-transfers declaration parts (facts + explanations).
 *  Full ConventionModule assembly happens in module-registry.ts. */
export function createJacobyTransfersDeclarations(sys: SystemConfig) {
  return {
    facts: createTransferFacts(sys),
    explanationEntries: TRANSFER_EXPLANATION_ENTRIES,
  };
}

/** Self-contained factory producing a complete ConventionModule. */
export const moduleFactory = (sys: SystemConfig): ConventionModule => ({
  moduleId: "jacoby-transfers",
  description: "Jacoby Transfers — bid 2D/2H over 1NT to show a 5+ card major and let opener declare",
  purpose: "Right-side the contract so the strong 1NT hand stays hidden, while guaranteeing a trump fit when responder has a 5+ card major",
  ...createJacobyTransfersDeclarations(sys),
  local: jacobyTransfersLocal,
  states: createJacobyTransfersStates(sys),
});
