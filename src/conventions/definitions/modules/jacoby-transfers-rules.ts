/**
 * Jacoby Transfers — RuleModule for rule-based surface selection.
 *
 * Phases track the transfer conversation for each suit independently:
 * - idle: before transfer bid
 * - transferred-hearts: after 2D transfer (opener accepts)
 * - transferred-spades: after 2H transfer (opener accepts)
 * - accepted-hearts: after opener accepts hearts transfer (R3 surfaces)
 * - accepted-spades: after opener accepts spades transfer (R3 surfaces)
 * - placing-hearts: after responder's 3NT (opener decides)
 * - placing-spades: after responder's 3NT (opener decides)
 * - invited-hearts: after responder's 2NT invite (opener decides)
 * - invited-spades: after responder's 2NT invite (opener decides)
 */

import type { RuleModule } from "../../core/rule-module";
import type { NegotiationDelta } from "../../../core/contracts/committed-step";
import type { BidMeaning } from "../../../core/contracts/meaning";
import {
  jacobyTransfersModule,
  OPENER_TRANSFER_HEARTS_SURFACES,
  OPENER_TRANSFER_SPADES_SURFACES,
  TRANSFER_R3_HEARTS_SURFACES,
  TRANSFER_R3_SPADES_SURFACES,
  OPENER_PLACE_HEARTS_SURFACES,
  OPENER_PLACE_SPADES_SURFACES,
  OPENER_ACCEPT_INVITE_HEARTS_SURFACES,
  OPENER_ACCEPT_INVITE_SPADES_SURFACES,
  OPENER_ACCEPT_INVITE_RAISE_HEARTS_SURFACES,
  OPENER_ACCEPT_INVITE_RAISE_SPADES_SURFACES,
} from "./jacoby-transfers";

type Phase =
  | "idle"
  | "inactive"
  | "transferred-hearts"
  | "transferred-spades"
  | "accepted-hearts"
  | "accepted-spades"
  | "placing-hearts"
  | "placing-spades"
  | "invited-hearts"
  | "invited-spades"
  | "invite-raised-hearts"
  | "invite-raised-spades";

// R1 entry surfaces: transfer bids (2D, 2H)
const transferR1Surfaces = jacobyTransfersModule.entrySurfaces;

// ── Kernel deltas (derived from old FSM entryEffects) ───────────────

/** Transfer bid: forcing one round (opener must accept), responder is captain. */
const TRANSFER_BID_DELTA: NegotiationDelta = { forcing: "one-round", captain: "responder" };

/** Opener accepts hearts: forcing resolved, tentative fit agreed. */
const ACCEPT_HEARTS_DELTA: NegotiationDelta = {
  forcing: "none",
  fitAgreed: { strain: "hearts", confidence: "tentative" },
};

/** Opener accepts spades: forcing resolved, tentative fit agreed. */
const ACCEPT_SPADES_DELTA: NegotiationDelta = {
  forcing: "none",
  fitAgreed: { strain: "spades", confidence: "tentative" },
};

/** Captain transfers to opener (3NT placement, 2NT invite). */
const CAPTAIN_TO_OPENER_DELTA: NegotiationDelta = { captain: "opener" };

/** Map R3 transfer surfaces to claims with per-surface kernel deltas.
 *  3NT and 2NT bids transfer captaincy to opener; others are terminal. */
function withR3TransferDeltas(
  surfaces: readonly BidMeaning[],
): readonly { readonly surface: BidMeaning; readonly negotiationDelta?: NegotiationDelta }[] {
  return surfaces.map((s) => {
    if (s.sourceIntent.type === "TransferNTGame" || s.sourceIntent.type === "Invite") {
      return { surface: s, negotiationDelta: CAPTAIN_TO_OPENER_DELTA };
    }
    return { surface: s };
  });
}

export const jacobyTransfersRules: RuleModule<Phase> = {
  id: "jacoby-transfers",
  local: {
    initial: "idle",
    transitions: [
      // idle → transferred when transfer bid observed
      { from: "idle", to: "transferred-hearts", on: { act: "transfer", suit: "hearts" } },
      { from: "idle", to: "transferred-spades", on: { act: "transfer", suit: "spades" } },
      // idle → inactive on any non-transfer R1 action (prevents R1 entries at R3+)
      { from: "idle", to: "inactive", on: { act: "inquire" } },
      { from: "idle", to: "inactive", on: { act: "raise" } },
      { from: "idle", to: "inactive", on: { act: "place" } },
      { from: "idle", to: "inactive", on: { act: "signoff" } },
      // transferred → accepted when opener accepts
      { from: "transferred-hearts", to: "accepted-hearts", on: { act: "accept", feature: "heldSuit", suit: "hearts" } },
      { from: "transferred-spades", to: "accepted-spades", on: { act: "accept", feature: "heldSuit", suit: "spades" } },
      // accepted → placing when responder places 3NT (signoff in notrump)
      { from: "accepted-hearts", to: "placing-hearts", on: { act: "place", strain: "notrump" } },
      { from: "accepted-spades", to: "placing-spades", on: { act: "place", strain: "notrump" } },
      // accepted → invite-raised when responder bids 3M (suit invite raise with 6+ cards)
      // Must appear BEFORE the generic invite transition so the more-specific pattern matches first.
      { from: "accepted-hearts", to: "invite-raised-hearts", on: { act: "raise", strength: "invitational", feature: "heldSuit" } },
      { from: "accepted-spades", to: "invite-raised-spades", on: { act: "raise", strength: "invitational", feature: "heldSuit" } },
      // accepted → invited when responder raises with invitational strength (2NT)
      { from: "accepted-hearts", to: "invited-hearts", on: { act: "raise", strength: "invitational" } },
      { from: "accepted-spades", to: "invited-spades", on: { act: "raise", strength: "invitational" } },
    ],
  },
  rules: [
    // R1: Transfer entry (responder bids 2D/2H) — forcing one round
    {
      match: { local: "idle", turn: "responder" },
      claims: transferR1Surfaces.map((s) => ({
        surface: s,
        negotiationDelta: TRANSFER_BID_DELTA,
      })),
    },
    // Opener accepts hearts transfer — tentative fit agreed
    {
      match: { local: "transferred-hearts", turn: "opener" },
      claims: OPENER_TRANSFER_HEARTS_SURFACES.map((s) => ({
        surface: s,
        negotiationDelta: ACCEPT_HEARTS_DELTA,
      })),
    },
    // Opener accepts spades transfer — tentative fit agreed
    {
      match: { local: "transferred-spades", turn: "opener" },
      claims: OPENER_TRANSFER_SPADES_SURFACES.map((s) => ({
        surface: s,
        negotiationDelta: ACCEPT_SPADES_DELTA,
      })),
    },
    // R3 after hearts accept — per-surface deltas (3NT/2NT → captain to opener)
    {
      match: { local: "accepted-hearts", turn: "responder" },
      claims: withR3TransferDeltas(TRANSFER_R3_HEARTS_SURFACES),
    },
    // R3 after spades accept — per-surface deltas
    {
      match: { local: "accepted-spades", turn: "responder" },
      claims: withR3TransferDeltas(TRANSFER_R3_SPADES_SURFACES),
    },
    // Opener placement after hearts 3NT (terminal)
    {
      match: { local: "placing-hearts", turn: "opener" },
      claims: OPENER_PLACE_HEARTS_SURFACES.map((s) => ({ surface: s })),
    },
    // Opener placement after spades 3NT (terminal)
    {
      match: { local: "placing-spades", turn: "opener" },
      claims: OPENER_PLACE_SPADES_SURFACES.map((s) => ({ surface: s })),
    },
    // Opener invite accept/decline after hearts 2NT (terminal)
    {
      match: { local: "invited-hearts", turn: "opener" },
      claims: OPENER_ACCEPT_INVITE_HEARTS_SURFACES.map((s) => ({ surface: s })),
    },
    // Opener invite accept/decline after spades 2NT (terminal)
    {
      match: { local: "invited-spades", turn: "opener" },
      claims: OPENER_ACCEPT_INVITE_SPADES_SURFACES.map((s) => ({ surface: s })),
    },
    // Opener invite-raise accept/decline after hearts 3H (accept = 4H, terminal)
    {
      match: { local: "invite-raised-hearts", turn: "opener" },
      claims: OPENER_ACCEPT_INVITE_RAISE_HEARTS_SURFACES.map((s) => ({ surface: s })),
    },
    // Opener invite-raise accept/decline after spades 3S (accept = 4S, terminal)
    {
      match: { local: "invite-raised-spades", turn: "opener" },
      claims: OPENER_ACCEPT_INVITE_RAISE_SPADES_SURFACES.map((s) => ({ surface: s })),
    },
  ],
  facts: jacobyTransfersModule.facts,
  explanationEntries: jacobyTransfersModule.explanationEntries,
};
