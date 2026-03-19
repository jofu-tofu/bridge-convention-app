// ── Bridge Public Semantic Schema ────────────────────────────────────
//
// The shared vocabulary of registers, tags, and capabilities that
// base tracks and protocols coordinate through.
//
// This is the "public semantic contract" — any module setting a register
// here must conform to the documented type and invariants.

import type { PublicSemanticSchema, CapabilitySpec } from "./types";
import { and, exists, activeTag, not, reg } from "./types";

/**
 * Bridge-specific public semantic schema.
 *
 * Three coordination channels:
 * - Registers: payload values (agreed suit, HCP range, etc.)
 * - Tags: phase markers exported by states (agreement.verifiable, etc.)
 * - Capabilities: derived booleans combining registers + tags
 */
export const BRIDGE_SEMANTIC_SCHEMA: PublicSemanticSchema = {
  registers: {
    // ── Agreement ────────────────────────────────────────────
    "agreement.strain": {
      type: '{ type: "none" | "suit" | "notrump"; suit?: string }',
      description: "The agreed strain (suit or notrump). Set when both partners have explicitly or implicitly agreed on a denomination.",
      invariants: [
        "Once set to a specific suit/notrump, should only be changed by explicit renegotiation",
        "Must be set before slam investigation protocols can activate",
      ],
      writerPolicy: "singleLogicalOwner",
    },
    "agreement.status": {
      type: '"none" | "tentative" | "final" | "revoked"',
      description: "Status of the current agreement.",
      writerPolicy: "singleLogicalOwner",
    },
    "agreement.basis": {
      type: '"explicit" | "exhaustion" | "forced"',
      description: "How the agreement was reached — explicit bid, exhaustion of alternatives, or forced by convention.",
      writerPolicy: "singleLogicalOwner",
    },

    // ── Forcing state ────────────────────────────────────────
    "forcing.state": {
      type: '"none" | "oneRound" | "game" | "slam"',
      description: "Current forcing level of the auction.",
      writerPolicy: "multiWriter",
    },

    // ── Captain / obligation ─────────────────────────────────
    "captain.side": {
      type: '"opener" | "responder" | "none"',
      description: "Which side is currently captaining the auction.",
      writerPolicy: "singleLogicalOwner",
    },
    "obligation.kind": {
      type: "string",
      description: "Current obligation (e.g., 'ShowMajor', 'AcceptTransfer').",
      writerPolicy: "singleLogicalOwner",
    },
    "obligation.side": {
      type: '"opener" | "responder"',
      description: "Which side is obligated.",
      writerPolicy: "singleLogicalOwner",
    },

    // ── Competition ──────────────────────────────────────────
    "competition.mode": {
      type: '"none" | "overcalled" | "doubled" | "contested"',
      description: "Current competition state from opponent interference.",
      writerPolicy: "multiWriter",
    },

    // ── Slam investigation ───────────────────────────────────
    "slam.status": {
      type: '"none" | "investigating" | "accepted" | "rejected"',
      description: "Current slam investigation status.",
      writerPolicy: "singleLogicalOwner",
    },
    "slam.keycardCount": {
      type: "number",
      description: "Number of keycards shown during Blackwood/RKC.",
      writerPolicy: "singleLogicalOwner",
    },

    // ── Verification (Ogust, etc.) ───────────────────────────
    "verification.result": {
      type: '"none" | "passed" | "failed"',
      description: "Result of the most recent hand-verification protocol (e.g., Ogust).",
      writerPolicy: "singleLogicalOwner",
    },
  },

  capabilities: {
    // ── Slam investigation availability ──────────────────────
    "canInvestigateSlam": {
      id: "canInvestigateSlam",
      when: and(
        exists(reg("agreement.strain")),
        activeTag("agreement.final"),
        not(activeTag("slam.investigating")),
        not(activeTag("slam.done")),
      ),
      description: "Slam investigation protocols (Blackwood, cuebidding) may activate.",
    } satisfies CapabilitySpec,

    // ── Verification availability ────────────────────────────
    "canVerify": {
      id: "canVerify",
      when: and(
        activeTag("verification.available"),
        not(activeTag("verification.done")),
      ),
      description: "Hand-verification protocols (Ogust, etc.) may activate.",
    } satisfies CapabilitySpec,

    // ── Competition response ─────────────────────────────────
    "canRespondToCompetition": {
      id: "canRespondToCompetition",
      when: and(
        exists(reg("competition.mode")),
        not(activeTag("competition.handled")),
      ),
      description: "Competition-response protocols may activate.",
    } satisfies CapabilitySpec,
  },
};
