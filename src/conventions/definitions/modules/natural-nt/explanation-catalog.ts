import type {
  ExplanationEntry,
  MeaningExplanationEntry,
} from "../../../core/explanation-catalog";

import { NATURAL_NT_MEANING_IDS } from "./ids";
import type { NaturalNtMeaningId } from "./ids";

// ─── Meaning explanations (exhaustive over NaturalNtMeaningId) ──

const MEANING_EXPLANATIONS: Record<NaturalNtMeaningId, MeaningExplanationEntry> = {
  [NATURAL_NT_MEANING_IDS.NT_OPENING]: {
    explanationId: "nt.naturalNt.opening",
    meaningId: NATURAL_NT_MEANING_IDS.NT_OPENING,
    templateKey: "nt.naturalNt.opening.semantic",
    displayText: "1NT opening: balanced hand with 15-17 HCP",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [NATURAL_NT_MEANING_IDS.NT_INVITE]: {
    explanationId: "nt.naturalNt.invite",
    meaningId: NATURAL_NT_MEANING_IDS.NT_INVITE,
    templateKey: "nt.naturalNt.invite.semantic",
    displayText: "2NT invite: invitational values, no 4-card major",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [NATURAL_NT_MEANING_IDS.TO_3NT]: {
    explanationId: "nt.naturalNt.to3nt",
    meaningId: NATURAL_NT_MEANING_IDS.TO_3NT,
    templateKey: "nt.naturalNt.to3nt.semantic",
    displayText: "3NT game: game values, no 4-card major",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [NATURAL_NT_MEANING_IDS.OPEN_1C]: {
    explanationId: "natural.open.1c",
    meaningId: NATURAL_NT_MEANING_IDS.OPEN_1C,
    templateKey: "natural.open.1c.semantic",
    displayText: "1♣ opening: 12+ HCP, 3+ clubs",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [NATURAL_NT_MEANING_IDS.OPEN_1D]: {
    explanationId: "natural.open.1d",
    meaningId: NATURAL_NT_MEANING_IDS.OPEN_1D,
    templateKey: "natural.open.1d.semantic",
    displayText: "1♦ opening: 12+ HCP, 4+ diamonds",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [NATURAL_NT_MEANING_IDS.OPEN_1H]: {
    explanationId: "natural.open.1h",
    meaningId: NATURAL_NT_MEANING_IDS.OPEN_1H,
    templateKey: "natural.open.1h.semantic",
    displayText: "1♥ opening: 12+ HCP, 5+ hearts (SAYC/2-over-1) or 4+ (Acol)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [NATURAL_NT_MEANING_IDS.OPEN_1S]: {
    explanationId: "natural.open.1s",
    meaningId: NATURAL_NT_MEANING_IDS.OPEN_1S,
    templateKey: "natural.open.1s.semantic",
    displayText: "1♠ opening: 12+ HCP, 5+ spades (SAYC/2-over-1) or 4+ (Acol)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
};

// ─── Combined export ─────────────────────────────────────────

export const NT_EXPLANATION_ENTRIES: readonly ExplanationEntry[] = [
  ...Object.values(MEANING_EXPLANATIONS),
];
