/**
 * Canonical Observation Ontology — bridge-universal semantic observations.
 *
 * Each `CanonicalObs` describes a single bridge communicative act in convention-erased
 * terms. Modules produce convention-shaped `sourceIntent` strings ("StaymanAsk",
 * "DONTRevealClubs"); the normalization layer translates them into canonical
 * observations ("inquire(majorSuit)", "show(heldSuit, clubs)").
 *
 * **Stability goal:** The 17 acts below cover all current conventions plus forward
 * provisions for RKCB, Control Cuebids, NT stoppers, and competitive bidding. When
 * authoring a new convention, use existing acts with new parameterizations first.
 * Only propose a new act when no existing act captures the communicative semantics.
 * Expect at most 1–2 additions for slam or advanced competitive conventions.
 *
 * **Consumers:** Pattern matchers (continuation composition), CommittedStep pipeline,
 * strategy layer. Producers: `normalizeIntent()` in `conventions/core/pipeline/`.
 */

// ── Parameter domains ──────────────────────────────────────────────

export type ObsSuit = "clubs" | "diamonds" | "hearts" | "spades";
export type ObsStrain = ObsSuit | "notrump";

export type ObsFeature =
  | "heldSuit" // holding a specific suit (5+ cards or 4 if shown)
  | "shortMajor" // 4-card major (Smolen: bid suit = short major)
  | "majorSuit" // 4+ card major (unspecified which)
  | "twoSuited" // two-suited hand
  | "suitQuality" // suit texture (good/bad/solid)
  | "strength" // hand strength generally
  | "shortage" // short suit (void/singleton/doubleton)
  | "fit" // fit for partner's suit
  | "balanced" // balanced shape
  | "control" // control in a suit (ace/void/king/singleton)
  | "keyCards" // RKCB keycards
  | "stopper"; // suit stopper for NT

export type ObsStrength =
  | "minimum"
  | "maximum"
  | "invitational"
  | "game"
  | "slam"
  | "preemptive"
  | "constructive"
  | "limit"
  | "weak"
  | "strong";

export type ObsQuality = "good" | "bad" | "solid";

// ── Observation acts ───────────────────────────────────────────────

/**
 * Discriminated union of bridge communicative acts.
 *
 * Each variant models a single semantic observation. One `sourceIntent` may
 * produce multiple observations (e.g., Splinter = shortage + raise).
 *
 * **`overcall` vs `show`:** `overcall` marks competitive entry — structurally
 * distinct from cooperative `show`. A natural 2H overcall is
 * `overcall(heldSuit, hearts)`. A 2H response to partner is
 * `show(heldSuit, hearts)`. Position (competitive vs cooperative) matters
 * for inference.
 */
export type CanonicalObs =
  | { readonly act: "open"; readonly strain: ObsStrain; readonly strength?: ObsStrength }
  | {
      readonly act: "show";
      readonly feature: ObsFeature;
      readonly suit?: ObsSuit;
      readonly quality?: ObsQuality;
      readonly strength?: ObsStrength;
    }
  | { readonly act: "deny"; readonly feature: ObsFeature; readonly suit?: ObsSuit }
  | { readonly act: "inquire"; readonly feature: ObsFeature; readonly suit?: ObsSuit }
  | { readonly act: "transfer"; readonly targetSuit: ObsSuit }
  | {
      readonly act: "accept";
      readonly feature: ObsFeature;
      readonly suit?: ObsSuit;
      readonly strength?: ObsStrength;
    }
  | { readonly act: "decline"; readonly feature: ObsFeature; readonly suit?: ObsSuit }
  | { readonly act: "raise"; readonly strain: ObsStrain; readonly strength: ObsStrength }
  | { readonly act: "place"; readonly strain: ObsStrain }
  | { readonly act: "signoff"; readonly strain?: ObsStrain }
  | { readonly act: "force"; readonly level: ObsStrength }
  | { readonly act: "agree"; readonly strain: ObsStrain }
  | { readonly act: "relay"; readonly forced: boolean }
  | { readonly act: "overcall"; readonly feature: ObsFeature; readonly suit?: ObsSuit }
  | { readonly act: "double"; readonly feature: ObsFeature }
  | { readonly act: "pass" }
  | { readonly act: "redouble"; readonly feature: ObsFeature };

// ── Runtime enumeration ────────────────────────────────────────────

/** All 17 act type strings — for exhaustive matching and iteration. */
export const OBS_ACTS = [
  "open",
  "show",
  "deny",
  "inquire",
  "transfer",
  "accept",
  "decline",
  "raise",
  "place",
  "signoff",
  "force",
  "agree",
  "relay",
  "overcall",
  "double",
  "pass",
  "redouble",
] as const;

export type ObsAct = (typeof OBS_ACTS)[number];
