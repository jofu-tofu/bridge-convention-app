import type { Call, Seat } from "../../../service";

export type ReferenceBid = Call | string;
export type ReferenceSeat = Seat | string;
export type ReferenceForcingToken = "NF" | "INV" | "F1" | "GF";
export type ReferenceRecommendation = "must" | "should" | "may" | "avoid";
export type ReferenceDisclosure = "alert" | "announcement" | "natural" | "standard";
export type ReferenceActionFamily =
  | "signoff"
  | "invite"
  | "force"
  | "asking"
  | "competitive"
  | "other";

export interface ReferenceSummaryCard {
  readonly trigger: string;
  readonly bid: ReferenceBid;
  readonly promises: string;
  readonly denies: string;
  readonly guidingIdea: string;
  readonly partnership: string;
}

export interface ReferenceWhenNotItem {
  readonly text: string;
  readonly reason: string;
}

export interface ReferenceResponseTableRow {
  readonly meaningId: string;
  readonly response: ReferenceBid;
  readonly meaning: string;
  readonly shape: string;
  readonly hcp: string;
  readonly forcing: ReferenceForcingToken | null;
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

export interface ReferenceContinuationSurface {
  readonly meaningId: string;
  readonly teachingLabel: ReferenceTeachingLabel;
  readonly call: ReferenceBid;
  readonly recommendation: ReferenceRecommendation | null;
  readonly disclosure: ReferenceDisclosure | null;
  readonly explanationText: string | null;
  readonly clauses: readonly ReferenceClause[];
}

export interface ReferenceContinuationPhase {
  readonly phase: string;
  readonly phaseDisplay: string;
  readonly turn: string | null;
  readonly transitionLabel: string | null;
  readonly surfaces: readonly ReferenceContinuationSurface[];
}

export interface ReferenceDecisionAxis {
  readonly label: string;
  readonly description?: string;
}

export interface ReferenceDecisionCell {
  readonly bid: ReferenceBid;
  readonly meaning: string;
  readonly note?: string;
  readonly family?: ReferenceActionFamily;
}

export interface ReferenceDecisionGrid {
  readonly rows: readonly ReferenceDecisionAxis[];
  readonly cols: readonly ReferenceDecisionAxis[];
  readonly cells: readonly (readonly (ReferenceDecisionCell | null)[])[];
}

export interface ReferenceWorkedAuctionCall {
  readonly seat: ReferenceSeat;
  readonly call: ReferenceBid;
  readonly rationale: string;
  readonly meaningId?: string | null;
}

export interface ReferenceWorkedAuction {
  readonly label: string;
  readonly calls: readonly ReferenceWorkedAuctionCall[];
  readonly outcomeNote?: string | null;
}

export interface ReferenceInterferenceItem {
  readonly opponentAction: string;
  readonly ourAction: ReferenceBid;
  readonly note: string;
}

export interface ReferenceSystemCompat {
  readonly sayc: string;
  readonly twoOverOne: string;
  readonly acol: string;
  readonly customNote: string;
}

export interface ReferenceRelatedLink {
  readonly moduleId: string;
  readonly discriminator: string;
}

export interface ReferenceView {
  readonly summaryCard: ReferenceSummaryCard;
  readonly whenToUse: readonly string[];
  readonly whenNotToUse: readonly ReferenceWhenNotItem[];
  readonly responseTableRows: readonly ReferenceResponseTableRow[];
  readonly workedAuctions: readonly ReferenceWorkedAuction[];
  readonly interference: readonly ReferenceInterferenceItem[];
  readonly decisionGrid: ReferenceDecisionGrid | null;
  readonly systemCompat: ReferenceSystemCompat;
  readonly relatedLinks: readonly ReferenceRelatedLink[];
}
