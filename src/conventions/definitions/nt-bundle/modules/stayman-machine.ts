import type { MachineState, MachineTransition } from "../../../core/runtime/machine-types";
import { BidSuit } from "../../../../engine/types";

// ─── R1 transition ───────────────────────────────────────────

export const STAYMAN_R1_TRANSITION: MachineTransition = {
  transitionId: "r1-stayman",
  match: { kind: "call", level: 2, strain: BidSuit.Clubs },
  target: "opener-stayman",
};

// ─── Machine states ──────────────────────────────────────────

export const STAYMAN_MACHINE_STATES: readonly MachineState[] = [
  {
    stateId: "stayman-scope",
    parentId: "nt-opened",
    transitions: [
      {
        transitionId: "stayman-opponent-interrupt",
        match: { kind: "opponent-action" },
        target: "stayman-interrupted",
      },
    ],
    allowedParentTransitions: ["nt-opened-opponent-interrupt", "nt-opened-pass"],
  },
  {
    stateId: "stayman-interrupted",
    parentId: "stayman-scope",
    transitions: [
      {
        transitionId: "stayman-interrupted-absorb",
        match: { kind: "pass" },
        target: "stayman-interrupted",
      },
    ],
    surfaceGroupId: "stayman-interrupted",
    entryEffects: { setCompetitionMode: "Contested" },
    allowedParentTransitions: ["stayman-opponent-interrupt", "nt-opened-opponent-interrupt"],
  },
  {
    stateId: "opener-stayman",
    parentId: "stayman-scope",
    allowedParentTransitions: ["stayman-opponent-interrupt", "nt-opened-opponent-interrupt"],
    transitions: [
      {
        transitionId: "stayman-pass",
        match: { kind: "pass" },
        target: "opener-stayman",
      },
      {
        transitionId: "stayman-2h",
        match: { kind: "call", level: 2, strain: BidSuit.Hearts },
        target: "responder-r3-stayman-2h",
      },
      {
        transitionId: "stayman-2s",
        match: { kind: "call", level: 2, strain: BidSuit.Spades },
        target: "responder-r3-stayman-2s",
      },
      {
        transitionId: "stayman-2d",
        match: { kind: "call", level: 2, strain: BidSuit.Diamonds },
        target: "responder-r3-stayman-2d",
      },
    ],
    surfaceGroupId: "opener-stayman-response",
    entryEffects: {
      setObligation: { kind: "ShowMajor", obligatedSide: "opener" },
    },
  },
  {
    stateId: "responder-r3-stayman-2h",
    parentId: "stayman-scope",
    allowedParentTransitions: ["stayman-opponent-interrupt", "nt-opened-opponent-interrupt"],
    transitions: [
      {
        transitionId: "r3-4h-game",
        match: { kind: "call", level: 4, strain: BidSuit.Hearts },
        target: "terminal",
      },
      {
        transitionId: "r3-3h-invite",
        match: { kind: "call", level: 3, strain: BidSuit.Hearts },
        target: "terminal",
      },
      {
        transitionId: "r3-3nt-no-fit",
        match: { kind: "call", level: 3, strain: BidSuit.NoTrump },
        target: "terminal",
      },
      {
        transitionId: "r3-2nt-invite-no-fit",
        match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
        target: "terminal",
      },
      {
        transitionId: "r3-self-pass-2h",
        match: { kind: "pass", seatRole: "self" },
        target: "terminal",
      },
      {
        transitionId: "r3-opp-pass-wait-2h",
        match: { kind: "pass", seatRole: "opponent" },
        target: "responder-r3-stayman-2h",
      },
      {
        transitionId: "r3-partner-pass-2h",
        match: { kind: "pass", seatRole: "partner" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "responder-r3-after-stayman-2h",
  },
  {
    stateId: "responder-r3-stayman-2s",
    parentId: "stayman-scope",
    allowedParentTransitions: ["stayman-opponent-interrupt", "nt-opened-opponent-interrupt"],
    transitions: [
      {
        transitionId: "r3-4s-game",
        match: { kind: "call", level: 4, strain: BidSuit.Spades },
        target: "terminal",
      },
      {
        transitionId: "r3-3s-invite",
        match: { kind: "call", level: 3, strain: BidSuit.Spades },
        target: "terminal",
      },
      {
        transitionId: "r3-3nt-no-fit-s",
        match: { kind: "call", level: 3, strain: BidSuit.NoTrump },
        target: "terminal",
      },
      {
        transitionId: "r3-2nt-invite-no-fit-s",
        match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
        target: "terminal",
      },
      {
        transitionId: "r3-self-pass-2s",
        match: { kind: "pass", seatRole: "self" },
        target: "terminal",
      },
      {
        transitionId: "r3-opp-pass-wait-2s",
        match: { kind: "pass", seatRole: "opponent" },
        target: "responder-r3-stayman-2s",
      },
      {
        transitionId: "r3-partner-pass-2s",
        match: { kind: "pass", seatRole: "partner" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "responder-r3-after-stayman-2s",
  },
  // responder-r3-stayman-2d: Smolen transitions removed — added via hookTransitions
  {
    stateId: "responder-r3-stayman-2d",
    parentId: "stayman-scope",
    allowedParentTransitions: ["stayman-opponent-interrupt", "nt-opened-opponent-interrupt"],
    transitions: [
      {
        transitionId: "r3-3nt-after-denial",
        match: { kind: "call", level: 3, strain: BidSuit.NoTrump },
        target: "terminal",
      },
      {
        transitionId: "r3-2nt-after-denial",
        match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
        target: "terminal",
      },
      {
        transitionId: "r3-self-pass-2d",
        match: { kind: "pass", seatRole: "self" },
        target: "terminal",
      },
      {
        transitionId: "r3-opp-pass-wait-2d",
        match: { kind: "pass", seatRole: "opponent" },
        target: "responder-r3-stayman-2d",
      },
      {
        transitionId: "r3-partner-pass-2d",
        match: { kind: "pass", seatRole: "partner" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "responder-r3-after-stayman-2d",
  },
];
