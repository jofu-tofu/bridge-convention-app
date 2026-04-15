import type { Call, Seat } from "../../../service";

export type ReferenceBid = Call | string;
export type ReferenceSeat = Seat | string;
export type ReferenceForcingToken = "NF" | "INV" | "F1" | "GF";
export type ReferenceRecommendation = "must" | "should" | "may" | "avoid";
export type ReferenceDisclosure =
  | "alert"
  | "announcement"
  | "natural"
  | "standard";
export type ReferenceActionFamily =
  | "signoff"
  | "invite"
  | "force"
  | "asking"
  | "competitive"
  | "other";

export interface ReferenceSummaryCardPeer {
  readonly meaningId: string;
  readonly call: ReferenceBid;
  readonly callDisplay: string;
  readonly promises: string;
  readonly denies: string;
  readonly discriminatorLabel: string;
}

export interface ReferenceSummaryCard {
  readonly trigger: string;
  readonly bid: ReferenceBid;
  readonly promises: string;
  readonly denies: string;
  readonly guidingIdea: string;
  readonly partnership: string;
  readonly peers: readonly ReferenceSummaryCardPeer[];
}

export interface ReferenceWhenNotItem {
  readonly text: string;
  readonly reason: string;
}

export interface ReferencePredicateBullet {
  readonly predicate: unknown;
  readonly gloss: string;
  readonly predicateText?: string | null;
}

export interface ReferenceResponseTableColumn {
  readonly id: string;
  readonly label: string;
}

export interface ReferenceResponseTableCell {
  readonly columnId: string;
  readonly columnLabel: string;
  readonly text: string;
}

export interface ReferenceResponseTableRow {
  readonly meaningId: string;
  readonly response: ReferenceBid;
  readonly meaning: string;
  readonly cells: readonly ReferenceResponseTableCell[];
}

export interface ReferenceResponseTable {
  readonly columns: readonly ReferenceResponseTableColumn[];
  readonly rows: readonly ReferenceResponseTableRow[];
}

export interface ReferenceClauseSystemVariant {
  readonly systemLabel: string;
  readonly description: string;
  readonly trumpTpDescription?: string;
}

export interface ReferenceClause {
  readonly factId: string;
  readonly operator: string;
  readonly description: string;
  readonly isPublic: boolean;
  readonly systemVariants?: readonly ReferenceClauseSystemVariant[];
  readonly relevantMetric?: "hcp" | "trumpTp";
}

export interface ReferenceTeachingLabel {
  readonly name: string;
  readonly summary: string;
}

// ResolvedAxis: Rust flattens authored axis variants into this single
// build-time shape. Labels are already rendered strings.
export interface ReferenceResolvedAxis {
  readonly label: string;
  readonly values: readonly string[];
}

export interface ReferenceQuickReferenceListItem {
  readonly recommendation: string;
  readonly note: string;
}

export type ReferenceResolvedCellKind = "action" | "notApplicable" | "empty";

export interface ReferenceResolvedCell {
  readonly call: string;
  readonly gloss?: string;
  readonly kind: ReferenceResolvedCellKind;
  readonly notApplicableReasonText?: string | null;
}

export type ReferenceQuickReference =
  | {
      readonly kind: "grid";
      readonly rowAxis: ReferenceResolvedAxis;
      readonly colAxis: ReferenceResolvedAxis;
      readonly cells: readonly (readonly ReferenceResolvedCell[])[];
    }
  | {
      readonly kind: "list";
      readonly axis: ReferenceResolvedAxis;
      readonly items: readonly ReferenceQuickReferenceListItem[];
    };

export interface ReferenceWorkedAuctionCall {
  readonly seat: ReferenceSeat;
  readonly call: ReferenceBid;
  readonly rationale: string;
  readonly meaningId?: string | null;
}

export type ReferenceWorkedAuctionKind = "positive" | "negative";

export interface ReferenceHandSample {
  readonly spades: string;
  readonly hearts: string;
  readonly diamonds: string;
  readonly clubs: string;
}

export interface ReferenceWorkedAuction {
  readonly kind: ReferenceWorkedAuctionKind;
  readonly label: string;
  readonly calls: readonly ReferenceWorkedAuctionCall[];
  readonly responderHand?: ReferenceHandSample | null;
}

export interface ReferenceInterferenceItem {
  readonly opponentAction: string;
  readonly ourAction: ReferenceBid;
  readonly note: string;
}

export type ReferenceInterference =
  | {
      readonly status: "applicable";
      readonly items: readonly ReferenceInterferenceItem[];
    }
  | { readonly status: "notApplicable"; readonly reason: string };

export interface ReferenceRelatedLink {
  readonly moduleId: string;
  readonly discriminator: string;
}

export interface ReferenceView {
  readonly summaryCard: ReferenceSummaryCard;
  readonly whenToUse: readonly ReferencePredicateBullet[];
  readonly whenNotToUse: readonly ReferenceWhenNotItem[];
  readonly responseTable: ReferenceResponseTable;
  readonly workedAuctions: readonly ReferenceWorkedAuction[];
  readonly interference: ReferenceInterference;
  readonly quickReference: ReferenceQuickReference;
  readonly relatedLinks: readonly ReferenceRelatedLink[];
}
