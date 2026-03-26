import type { BidMeaning } from "../../../pipeline/evaluation/meaning";
import { BidSuit } from "../../../../engine/types";
import { BRIDGE_SEMANTIC_CLASSES } from "../../../pipeline/evaluation/meaning";
import type { SystemConfig } from "../../system-config";
import {
  SYSTEM_RESPONDER_INVITE_VALUES,
  SYSTEM_RESPONDER_GAME_VALUES,
} from "../../system-fact-vocabulary";

import { bid } from "../../../core/surface-helpers";
import { createSurface } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";

import { NATURAL_NT_MEANING_IDS } from "./ids";

// ─── Module context ──────────────────────────────────────────

const NATURAL_NT_CTX: ModuleContext = { moduleId: "natural-nt" };

// ─── R1 surfaces ─────────────────────────────────────────────

export function createNtR1Surfaces(sys: SystemConfig): readonly BidMeaning[] {
  return [
    createSurface({
      meaningId: NATURAL_NT_MEANING_IDS.NT_INVITE,
      semanticClassId: BRIDGE_SEMANTIC_CLASSES.NT_INVITE,
      encoding: bid(2, BidSuit.NoTrump),
      clauses: [
        {
          factId: SYSTEM_RESPONDER_INVITE_VALUES,
          operator: "boolean",
          value: true,
          rationale: "invite values opposite 1NT",
          isPublic: true,
        },
        {
          factId: "bridge.hasFourCardMajor",
          operator: "boolean",
          value: false,
          isPublic: true,
        },
        {
          factId: "bridge.hasFiveCardMajor",
          operator: "boolean",
          value: false,
          isPublic: true,
        },
      ],
      band: "may",
      declarationOrder: 0,
      sourceIntent: { type: "NTInvite", params: {} },
      disclosure: "natural",
      teachingLabel: "NT invite",
    }, NATURAL_NT_CTX),

    createSurface({
      meaningId: NATURAL_NT_MEANING_IDS.TO_3NT,
      semanticClassId: BRIDGE_SEMANTIC_CLASSES.NT_GAME,
      encoding: bid(3, BidSuit.NoTrump),
      clauses: [
        {
          factId: SYSTEM_RESPONDER_GAME_VALUES,
          operator: "boolean",
          value: true,
          rationale: "game values opposite 1NT",
          isPublic: true,
        },
        {
          factId: "bridge.hasFourCardMajor",
          operator: "boolean",
          value: false,
          isPublic: true,
        },
        {
          factId: "bridge.hasFiveCardMajor",
          operator: "boolean",
          value: false,
          isPublic: true,
        },
      ],
      band: "may",
      declarationOrder: 1,
      sourceIntent: { type: "NTGame", params: {} },
      disclosure: "natural",
      teachingLabel: "3NT game",
    }, NATURAL_NT_CTX),
  ];
}

// ─── Opener 1NT surface (used as surface group for idle state) ───
// Declares the 1NT opening promise (HCP range, balanced) so that the
// commitment extractor produces public constraints for the posterior sampler.

export function createOpener1NtSurface(sys: SystemConfig): readonly BidMeaning[] {
  return [
    createSurface({
      meaningId: NATURAL_NT_MEANING_IDS.NT_OPENING,
      semanticClassId: BRIDGE_SEMANTIC_CLASSES.NT_OPENING,
      encoding: bid(1, BidSuit.NoTrump),
      clauses: [
        {
          factId: "hand.hcp",
          operator: "gte",
          value: sys.ntOpening.minHcp,
          isPublic: true,
        },
        {
          factId: "hand.hcp",
          operator: "lte",
          value: sys.ntOpening.maxHcp,
          isPublic: true,
        },
        {
          factId: "hand.isBalanced",
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "NTOpening", params: {} },
      disclosure: "natural",
      teachingLabel: `${sys.ntOpening.minHcp} to ${sys.ntOpening.maxHcp}`,
    }, NATURAL_NT_CTX),
  ];
}
