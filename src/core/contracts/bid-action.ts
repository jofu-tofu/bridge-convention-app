/**
 * Canonical Observation Ontology — bridge-universal semantic observations.
 *
 * Each `BidAction` describes a single bridge communicative act in convention-erased
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
export type BidSuitName = ObsSuit | "notrump";

export type HandFeature =
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

export type HandStrength =
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

export type SuitQuality = "good" | "bad" | "solid";

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
export type BidAction =
  | { readonly act: "open"; readonly strain: BidSuitName; readonly strength?: HandStrength }
  | {
      readonly act: "show";
      readonly feature: HandFeature;
      readonly suit?: ObsSuit;
      readonly quality?: SuitQuality;
      readonly strength?: HandStrength;
    }
  | { readonly act: "deny"; readonly feature: HandFeature; readonly suit?: ObsSuit }
  | { readonly act: "inquire"; readonly feature: HandFeature; readonly suit?: ObsSuit }
  | { readonly act: "transfer"; readonly targetSuit: ObsSuit }
  | {
      readonly act: "accept";
      readonly feature: HandFeature;
      readonly suit?: ObsSuit;
      readonly strength?: HandStrength;
    }
  | { readonly act: "decline"; readonly feature: HandFeature; readonly suit?: ObsSuit }
  | { readonly act: "raise"; readonly strain: BidSuitName; readonly strength: HandStrength }
  | { readonly act: "place"; readonly strain: BidSuitName }
  | { readonly act: "signoff"; readonly strain?: BidSuitName }
  | { readonly act: "force"; readonly level: HandStrength }
  | { readonly act: "agree"; readonly strain: BidSuitName }
  | { readonly act: "relay"; readonly forced: boolean }
  | { readonly act: "overcall"; readonly feature: HandFeature; readonly suit?: ObsSuit }
  | { readonly act: "double"; readonly feature: HandFeature }
  | { readonly act: "pass" }
  | { readonly act: "redouble"; readonly feature: HandFeature };

// ── Runtime enumeration ────────────────────────────────────────────

/** All 17 act type strings — for exhaustive matching and iteration. */
export const BID_ACTION_TYPES = [
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

export type BidActionType = (typeof BID_ACTION_TYPES)[number];
