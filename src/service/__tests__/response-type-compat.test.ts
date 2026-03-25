/**
 * Shape-compatibility tests for service-owned types vs backend counterparts.
 *
 * These compile-time checks verify bidirectional structural compatibility:
 * backend → service and service → backend. This prevents silent shape drift
 * when either side changes independently.
 *
 * Test mechanism: TypeScript `satisfies`-style assignment checks. If a type
 * assignment fails, the test file won't compile — caught by `npx tsc --noEmit`.
 */
import { describe, it, expect } from "vitest";

// ── Backend types ──────────────────────────────────────────────────
import type { GamePhase } from "../../session/phase-machine";
import type { EncoderKind } from "../../conventions/pipeline/evaluation/provenance";
import type { BidGrade } from "../../conventions/teaching/teaching-types";
import type {
  ExplanationNode,
  WhyNotEntry,
  ConventionContribution,
  MeaningView,
  CallProjection,
  ParseTreeView,
  ParseTreeModuleNode,
  ParseTreeCondition,
  ParseTreeModuleVerdict,
} from "../../conventions/teaching/teaching-types";
import type { ConditionEvidence } from "../../conventions/pipeline/evidence-bundle";
import type { BidHistoryEntry } from "../../conventions/core/strategy-types";
import type { FactConstraint } from "../../conventions/core/agreement-module";
import type {
  PublicBeliefs,
  DerivedRanges,
  QualitativeConstraint,
} from "../../inference/inference-types";
import type { InferenceSnapshot, BidAnnotation, PublicBeliefState } from "../../inference/types";

// ── Service-owned types ────────────────────────────────────────────
import type {
  ServiceGamePhase,
  ViewportBidGrade,
  ServiceEncoderKind,
  ServiceExplanationNode,
  ServiceWhyNotEntry,
  ServiceConventionContribution,
  ServiceConditionEvidence,
  ServiceMeaningView,
  ServiceCallProjection,
  ServiceParseTreeView,
  ServiceParseTreeModuleNode,
  ServiceParseTreeCondition,
  ServiceParseTreeModuleVerdict,
  ServiceBidHistoryEntry,
  ServiceFactConstraint,
  ServicePublicBeliefs,
  ServiceDerivedRanges,
  ServiceQualitativeConstraint,
  ServiceInferenceSnapshot,
  ServiceBidAnnotation,
  ServicePublicBeliefState,
} from "../response-types";

// ── Bidirectional compatibility checks ─────────────────────────────
//
// Each pair of assignments verifies that the types are exact structural
// mirrors. If a field is added/removed/renamed on either side, one of
// these assignments will fail to compile.

// GamePhase ↔ ServiceGamePhase
const _gp1: ServiceGamePhase = "" as GamePhase;
const _gp2: GamePhase = "" as ServiceGamePhase;

// BidGrade (enum values) ↔ ViewportBidGrade (string union)
const _bg1: ViewportBidGrade = "" as `${BidGrade}`;
const _bg2: `${BidGrade}` = "" as ViewportBidGrade;

// EncoderKind ↔ ServiceEncoderKind
const _ek1: ServiceEncoderKind = "" as EncoderKind;
const _ek2: EncoderKind = "" as ServiceEncoderKind;

// ExplanationNode ↔ ServiceExplanationNode
const _en1: ServiceExplanationNode = {} as ExplanationNode;
const _en2: ExplanationNode = {} as ServiceExplanationNode;

// WhyNotEntry ↔ ServiceWhyNotEntry
const _wn1: ServiceWhyNotEntry = {} as WhyNotEntry;
const _wn2: WhyNotEntry = {} as ServiceWhyNotEntry;

// ConventionContribution ↔ ServiceConventionContribution
const _cc1: ServiceConventionContribution = {} as ConventionContribution;
const _cc2: ConventionContribution = {} as ServiceConventionContribution;

// ConditionEvidence ↔ ServiceConditionEvidence
const _ce1: ServiceConditionEvidence = {} as ConditionEvidence;
const _ce2: ConditionEvidence = {} as ServiceConditionEvidence;

// MeaningView ↔ ServiceMeaningView
const _mv1: ServiceMeaningView = {} as MeaningView;
const _mv2: MeaningView = {} as ServiceMeaningView;

// CallProjection ↔ ServiceCallProjection
const _cp1: ServiceCallProjection = {} as CallProjection;
const _cp2: CallProjection = {} as ServiceCallProjection;

// ParseTreeCondition ↔ ServiceParseTreeCondition
const _ptc1: ServiceParseTreeCondition = {} as ParseTreeCondition;
const _ptc2: ParseTreeCondition = {} as ServiceParseTreeCondition;

// ParseTreeModuleVerdict ↔ ServiceParseTreeModuleVerdict
const _ptmv1: ServiceParseTreeModuleVerdict = "" as ParseTreeModuleVerdict;
const _ptmv2: ParseTreeModuleVerdict = "" as ServiceParseTreeModuleVerdict;

// ParseTreeModuleNode ↔ ServiceParseTreeModuleNode
const _ptmn1: ServiceParseTreeModuleNode = {} as ParseTreeModuleNode;
const _ptmn2: ParseTreeModuleNode = {} as ServiceParseTreeModuleNode;

// ParseTreeView ↔ ServiceParseTreeView
const _ptv1: ServiceParseTreeView = {} as ParseTreeView;
const _ptv2: ParseTreeView = {} as ServiceParseTreeView;

// FactConstraint ↔ ServiceFactConstraint
const _fc1: ServiceFactConstraint = {} as FactConstraint;
const _fc2: FactConstraint = {} as ServiceFactConstraint;

// QualitativeConstraint ↔ ServiceQualitativeConstraint
const _qc1: ServiceQualitativeConstraint = {} as QualitativeConstraint;
const _qc2: QualitativeConstraint = {} as ServiceQualitativeConstraint;

// DerivedRanges ↔ ServiceDerivedRanges
const _dr1: ServiceDerivedRanges = {} as DerivedRanges;
const _dr2: DerivedRanges = {} as ServiceDerivedRanges;

// PublicBeliefs ↔ ServicePublicBeliefs
const _pb1: ServicePublicBeliefs = {} as PublicBeliefs;
const _pb2: PublicBeliefs = {} as ServicePublicBeliefs;

// BidAnnotation ↔ ServiceBidAnnotation
const _ba1: ServiceBidAnnotation = {} as BidAnnotation;
const _ba2: BidAnnotation = {} as ServiceBidAnnotation;

// PublicBeliefState ↔ ServicePublicBeliefState
const _pbs1: ServicePublicBeliefState = {} as PublicBeliefState;
const _pbs2: PublicBeliefState = {} as ServicePublicBeliefState;

// InferenceSnapshot ↔ ServiceInferenceSnapshot
const _is1: ServiceInferenceSnapshot = {} as InferenceSnapshot;
const _is2: InferenceSnapshot = {} as ServiceInferenceSnapshot;

// ── Unidirectional checks (viewport-narrowed types) ────────────────
//
// ServiceBidHistoryEntry is intentionally narrower than BidHistoryEntry
// (omits BidResult and TeachingProjection fields). Backend → service works;
// service → backend works because omitted fields are optional.

const _bhe1: ServiceBidHistoryEntry = {} as BidHistoryEntry;
const _bhe2: BidHistoryEntry = {} as ServiceBidHistoryEntry;

// ── Runtime test (vitest needs at least one test) ──────────────────

describe("response-type-compat", () => {
  it("service-owned types are structurally compatible with backend types", () => {
    // This test exists to give vitest something to run.
    // The real checks are the compile-time assignments above.
    // If this file compiles, all compatibility checks pass.
    expect(true).toBe(true);
  });
});
