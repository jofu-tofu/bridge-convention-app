/**
 * Session & convention types — canonical TS definitions for the service boundary.
 *
 * These types match the Rust JSON schema (serde ↔ TS). The TS backend
 * (conventions/, session/) has been deleted — these are the sole TS type
 * declarations for data that crosses the WASM boundary. Frontend code
 * imports these through the service barrel.
 */

import { Seat, Vulnerability } from "../engine/types";
import type { Call, Card, DealConstraints, Deal, Auction, Hand, HandEvaluation } from "../engine/types";

// ── Convention types ───────────────────────────────────────────────

export enum ConventionCategory {
  Asking = "Asking",
  Defensive = "Defensive",
  Constructive = "Constructive",
  Competitive = "Competitive",
}

/** Convention-level teaching metadata. */
export interface ConventionTeaching {
  readonly purpose?: string;
  readonly whenToUse?: string;
  readonly tradeoff?: string;
  readonly principle?: string;
}

export interface ConventionConfig {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ConventionCategory;
  readonly teaching?: ConventionTeaching;
  readonly dealConstraints: DealConstraints;
  readonly offConventionConstraints?: DealConstraints;
  readonly defaultAuction?: (seat: Seat, deal?: Deal) => Auction | undefined;
  readonly internal?: boolean;
  readonly allowedDealers?: readonly Seat[];
  readonly variesBySystem?: boolean;
  readonly moduleDescriptions?: ReadonlyMap<string, string>;
  readonly modulePurposes?: ReadonlyMap<string, string>;
  readonly supportsRoleSelection?: boolean;
}

// ── Base system types ──────────────────────────────────────────────

export type BaseSystemId = "sayc" | "two-over-one" | "acol" | "custom";

/** Identifies a system selection in the TS layer. Never sent to Rust. */
export type SystemSelectionId = BaseSystemId | `custom:${string}`;

/** Default base module IDs merged into every spec. */
export const DEFAULT_BASE_MODULE_IDS: readonly string[] = [
  "natural-bids", "stayman", "jacoby-transfers", "blackwood",
] as const;

/**
 * Custom system stored in localStorage. Full config snapshot, not deltas.
 * Changing preset defaults does NOT propagate to existing custom systems.
 */
export interface CustomSystem {
  readonly id: `custom:${string}`;
  readonly name: string;
  readonly basedOn: BaseSystemId;
  readonly config: SystemConfig;
  readonly baseModuleIds: string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Point formula — toggleable components for total-point computation. */
export interface PointFormula {
  readonly includeShortage: boolean;
  readonly includeLength: boolean;
}

/** Point formula configuration per contract type (NT vs trump). */
export interface PointConfig {
  readonly ntFormula: PointFormula;
  readonly trumpFormula: PointFormula;
}

/** Normalize a PointFormula from either new object or legacy string format. */
export function normalizePointFormula(
  raw: PointFormula | string | undefined,
  fallback: PointFormula,
): PointFormula {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw === "object" && "includeShortage" in raw) return raw;
  if (typeof raw === "string") {
    switch (raw) {
      case "hcp-only": return { includeShortage: false, includeLength: false };
      case "hcp-plus-shortage": return { includeShortage: true, includeLength: false };
      case "hcp-plus-all-distribution": return { includeShortage: true, includeLength: true };
    }
  }
  return fallback;
}

/** Suit total-point equivalents for a threshold. */
export interface TotalPointEquivalent {
  readonly trump: number;
}

export interface NtOpeningConfig {
  readonly minHcp: number;
  readonly maxHcp: number;
}

export interface ResponderThresholds {
  readonly inviteMin: number;
  readonly inviteMax: number;
  readonly gameMin: number;
  readonly slamMin: number;
  readonly inviteMinTp: TotalPointEquivalent;
  readonly inviteMaxTp: TotalPointEquivalent;
  readonly gameMinTp: TotalPointEquivalent;
  readonly slamMinTp: TotalPointEquivalent;
}

export interface OpenerRebidThresholds {
  readonly notMinimum: number;
  readonly notMinimumTp: TotalPointEquivalent;
}

export interface InterferenceThresholds {
  readonly redoubleMin: number;
}

export interface SuitResponseConfig {
  readonly twoLevelMin: number;
  readonly twoLevelForcingDuration: "one-round" | "game";
}

export interface OneNtResponseAfterMajorConfig {
  readonly forcing: "non-forcing" | "forcing" | "semi-forcing";
  readonly maxHcp: number;
  readonly minHcp: number;
}

export interface DontOvercallConfig {
  readonly minHcp: number;
  readonly maxHcp: number;
}

export interface OpeningRequirements {
  readonly majorSuitMinLength: 4 | 5;
}

export interface SystemConfig {
  readonly systemId: BaseSystemId;
  readonly displayName: string;
  readonly ntOpening: NtOpeningConfig;
  readonly responderThresholds: ResponderThresholds;
  readonly openerRebid: OpenerRebidThresholds;
  readonly interference: InterferenceThresholds;
  readonly suitResponse: SuitResponseConfig;
  readonly oneNtResponseAfterMajor: OneNtResponseAfterMajorConfig;
  readonly openingRequirements: OpeningRequirements;
  readonly dontOvercall: DontOvercallConfig;
  readonly pointConfig?: PointConfig;
}

// ── System config constants ────────────────────────────────────────

export const SAYC_SYSTEM_CONFIG: SystemConfig = {
  systemId: "sayc",
  displayName: "Standard American Yellow Card",
  ntOpening: { minHcp: 15, maxHcp: 17 },
  responderThresholds: {
    inviteMin: 8, inviteMax: 9, gameMin: 10, slamMin: 15,
    inviteMinTp: { trump: 8 }, inviteMaxTp: { trump: 10 },
    gameMinTp: { trump: 10 }, slamMinTp: { trump: 16 },
  },
  openerRebid: { notMinimum: 16, notMinimumTp: { trump: 16 } },
  interference: { redoubleMin: 10 },
  suitResponse: { twoLevelMin: 10, twoLevelForcingDuration: "one-round" },
  oneNtResponseAfterMajor: { forcing: "non-forcing", maxHcp: 10, minHcp: 6 },
  openingRequirements: { majorSuitMinLength: 5 },
  dontOvercall: { minHcp: 8, maxHcp: 15 },
  pointConfig: {
    ntFormula: { includeShortage: false, includeLength: false },
    trumpFormula: { includeShortage: true, includeLength: false },
  },
};

export const TWO_OVER_ONE_SYSTEM_CONFIG: SystemConfig = {
  systemId: "two-over-one",
  displayName: "2/1 Game Forcing",
  ntOpening: { minHcp: 15, maxHcp: 17 },
  responderThresholds: {
    inviteMin: 8, inviteMax: 9, gameMin: 10, slamMin: 15,
    inviteMinTp: { trump: 8 }, inviteMaxTp: { trump: 10 },
    gameMinTp: { trump: 10 }, slamMinTp: { trump: 16 },
  },
  openerRebid: { notMinimum: 16, notMinimumTp: { trump: 16 } },
  interference: { redoubleMin: 10 },
  suitResponse: { twoLevelMin: 12, twoLevelForcingDuration: "game" },
  oneNtResponseAfterMajor: { forcing: "semi-forcing", maxHcp: 12, minHcp: 6 },
  openingRequirements: { majorSuitMinLength: 5 },
  dontOvercall: { minHcp: 8, maxHcp: 15 },
  pointConfig: {
    ntFormula: { includeShortage: false, includeLength: false },
    trumpFormula: { includeShortage: true, includeLength: false },
  },
};

export const ACOL_SYSTEM_CONFIG: SystemConfig = {
  systemId: "acol",
  displayName: "Acol",
  ntOpening: { minHcp: 12, maxHcp: 14 },
  responderThresholds: {
    inviteMin: 10, inviteMax: 12, gameMin: 13, slamMin: 19,
    inviteMinTp: { trump: 10 }, inviteMaxTp: { trump: 13 },
    gameMinTp: { trump: 13 }, slamMinTp: { trump: 20 },
  },
  openerRebid: { notMinimum: 13, notMinimumTp: { trump: 13 } },
  interference: { redoubleMin: 9 },
  suitResponse: { twoLevelMin: 10, twoLevelForcingDuration: "one-round" },
  oneNtResponseAfterMajor: { forcing: "non-forcing", maxHcp: 9, minHcp: 6 },
  openingRequirements: { majorSuitMinLength: 4 },
  dontOvercall: { minHcp: 8, maxHcp: 15 },
  pointConfig: {
    ntFormula: { includeShortage: false, includeLength: false },
    trumpFormula: { includeShortage: true, includeLength: false },
  },
};

interface BaseSystemMeta {
  readonly id: BaseSystemId;
  readonly label: string;
  readonly shortLabel: string;
}

export const AVAILABLE_BASE_SYSTEMS: readonly BaseSystemMeta[] = [
  { id: "sayc", label: "Standard American Yellow Card", shortLabel: "SAYC" },
  { id: "two-over-one", label: "2/1 Game Forcing", shortLabel: "2/1" },
  { id: "acol", label: "Acol", shortLabel: "Acol" },
] as const;

const SYSTEM_CONFIG_MAP: Readonly<Record<string, SystemConfig>> = {
  sayc: SAYC_SYSTEM_CONFIG,
  "two-over-one": TWO_OVER_ONE_SYSTEM_CONFIG,
  acol: ACOL_SYSTEM_CONFIG,
};

/** Look up SystemConfig by base system id. Falls back to SAYC for unknown ids. */
export function getSystemConfig(id: BaseSystemId): SystemConfig {
  return SYSTEM_CONFIG_MAP[id] ?? SAYC_SYSTEM_CONFIG;
}

// ── Session enums & types ──────────────────────────────────────────

export enum OpponentMode {
  Natural = "natural",
  None = "none",
}

export enum PracticeRole {
  Responder = "responder",
  Opener = "opener",
  Both = "both",
}

export enum PracticeMode {
  DecisionDrill = "decision-drill",
  FullAuction = "full-auction",
  ContinuationDrill = "continuation-drill",
}

export enum PlayPreference {
  Always = "always",
  Prompt = "prompt",
  Skip = "skip",
}

export enum PromptMode {
  SouthDeclarer = "south-declarer",
  DeclarerSwap = "declarer-swap",
  Defender = "defender",
}

// ── Drill types ────────────────────────────────────────────────────

export interface VulnerabilityDistribution {
  readonly none: number;
  readonly ours: number;
  readonly theirs: number;
  readonly both: number;
}

export interface DrillTuning {
  readonly vulnerabilityDistribution: VulnerabilityDistribution;
  readonly moduleWeights?: Readonly<Record<string, number>>;
  readonly includeOffConvention?: boolean;
  readonly offConventionRate?: number;
}

export const DEFAULT_DRILL_TUNING: DrillTuning = {
  vulnerabilityDistribution: { none: 1, ours: 0, theirs: 0, both: 0 },
};

export type PlayProfileId = "beginner" | "club-player" | "expert" | "world-class";

export interface PlayProfile {
  readonly id: PlayProfileId;
  readonly name: string;
  readonly description: string;
  readonly heuristicSkipRate: number;
  readonly skippableHeuristics: readonly string[];
  readonly useInferences: boolean;
  readonly inferenceNoise: number;
  readonly usePosterior: boolean;
  readonly useCardCounting: boolean;
}

export const PLAY_PROFILES: Record<PlayProfileId, PlayProfile> = {
  beginner: {
    id: "beginner", name: "Beginner",
    description: "Plays by the book but sometimes slips up. Good for learning the basics.",
    heuristicSkipRate: 0.15, skippableHeuristics: ["cover-honor-with-honor", "trump-management"],
    useInferences: false, inferenceNoise: 0, usePosterior: false, useCardCounting: false,
  },
  "club-player": {
    id: "club-player", name: "Club Player",
    description: "Pays attention to the auction, counts cards, and notices when suits are breaking unevenly.",
    heuristicSkipRate: 0, skippableHeuristics: [],
    useInferences: true, inferenceNoise: 0.25, usePosterior: false, useCardCounting: true,
  },
  expert: {
    id: "expert", name: "Expert",
    description: "Thinks several tricks ahead and finds the best line of play in most situations.",
    heuristicSkipRate: 0, skippableHeuristics: [],
    useInferences: true, inferenceNoise: 0, usePosterior: false, useCardCounting: true,
  },
  "world-class": {
    id: "world-class", name: "World Class",
    description: "Plays near-perfectly, using everything learned from the bidding to find the optimal card.",
    heuristicSkipRate: 0, skippableHeuristics: [],
    useInferences: true, inferenceNoise: 0, usePosterior: true, useCardCounting: true,
  },
};

export interface DrillSettings {
  readonly opponentMode: OpponentMode;
  readonly tuning: DrillTuning;
  readonly playProfileId?: PlayProfileId;
  readonly practiceMode?: PracticeMode;
  readonly playPreference?: PlayPreference;
  readonly practiceRole?: PracticeRole;
}

export const DEFAULT_DRILL_SETTINGS: DrillSettings = {
  opponentMode: OpponentMode.None,
  tuning: DEFAULT_DRILL_TUNING,
  playProfileId: "world-class",
};

// ── Phase machine ──────────────────────────────────────────────────

export type GamePhase =
  | "BIDDING"
  | "DECLARER_PROMPT"
  | "PLAYING"
  | "EXPLANATION";

const VALID_TRANSITIONS: Record<GamePhase, readonly GamePhase[]> = {
  BIDDING: ["DECLARER_PROMPT", "PLAYING", "EXPLANATION"],
  DECLARER_PROMPT: ["PLAYING", "EXPLANATION"],
  PLAYING: ["EXPLANATION"],
  EXPLANATION: ["DECLARER_PROMPT"],
};

export function isValidTransition(from: GamePhase, to: GamePhase): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

// ── Phase coordinator ──────────────────────────────────────────────

export type ViewportNeeded = "bidding" | "declarerPrompt" | "playing" | "explanation";

export type ServiceAction =
  | { type: "enterPlay"; seat?: Seat }
  | { type: "declinePlay" }
  | { type: "returnToPrompt" }
  | { type: "restartPlay" }
  | { type: "skipToReview" };

export type PhaseEvent =
  | { type: "AUCTION_COMPLETE"; servicePhase: GamePhase }
  | { type: "PROMPT_ENTERED"; playPreference: PlayPreference }
  | { type: "ACCEPT_PLAY"; seat?: Seat }
  | { type: "DECLINE_PLAY" }
  | { type: "SKIP_TO_REVIEW" }
  | { type: "PLAY_COMPLETE" }
  | { type: "PLAY_THIS_HAND"; seat: Seat }
  | { type: "RESTART_PLAY" };

export interface TransitionDescriptor {
  readonly targetPhase: GamePhase | null;
  readonly viewportsNeeded: readonly ViewportNeeded[];
  readonly triggerDDS: boolean;
  readonly captureInferences: boolean;
  readonly serviceActions: readonly ServiceAction[];
  readonly resetPlay: boolean;
  readonly chainedEvent: PhaseEvent | null;
  readonly intermediatePhases: readonly GamePhase[];
}

export interface TransitionResult {
  readonly serviceResult: PlayEntryResult | null;
  readonly completed: boolean;
}

export interface PlayEntryResult {
  readonly phase: GamePhase;
  readonly aiPlays?: readonly { seat: Seat; card: Card; reason: string; trickComplete?: boolean }[] | null;
}

function noTransition(): TransitionDescriptor {
  return {
    targetPhase: null, viewportsNeeded: [], triggerDDS: false,
    captureInferences: false, serviceActions: [], resetPlay: false, chainedEvent: null, intermediatePhases: [],
  };
}

function resolveAuctionComplete(servicePhase: GamePhase): TransitionDescriptor {
  switch (servicePhase) {
    case "DECLARER_PROMPT":
      return {
        targetPhase: "DECLARER_PROMPT", viewportsNeeded: ["declarerPrompt"],
        triggerDDS: true, captureInferences: true, serviceActions: [], resetPlay: false, chainedEvent: null, intermediatePhases: [],
      };
    case "PLAYING":
      return {
        targetPhase: "PLAYING", viewportsNeeded: ["playing"],
        triggerDDS: true, captureInferences: true, serviceActions: [], resetPlay: true, chainedEvent: null, intermediatePhases: [],
      };
    case "EXPLANATION":
      return {
        targetPhase: "EXPLANATION", viewportsNeeded: ["explanation"],
        triggerDDS: false, captureInferences: false, serviceActions: [], resetPlay: false, chainedEvent: null, intermediatePhases: [],
      };
    default:
      return noTransition();
  }
}

function resolvePromptEntered(playPreference: PlayPreference): TransitionDescriptor {
  switch (playPreference) {
    case PlayPreference.Skip:
      return {
        targetPhase: null, viewportsNeeded: [], triggerDDS: false,
        captureInferences: false, serviceActions: [],
        resetPlay: false,
        chainedEvent: { type: "DECLINE_PLAY" }, intermediatePhases: [],
      };
    case PlayPreference.Always:
      return {
        targetPhase: null, viewportsNeeded: [], triggerDDS: false,
        captureInferences: false, serviceActions: [],
        resetPlay: false,
        chainedEvent: { type: "ACCEPT_PLAY" }, intermediatePhases: [],
      };
    default:
      return noTransition();
  }
}

function resolveAcceptPlay(seat?: Seat): TransitionDescriptor {
  return {
    targetPhase: "PLAYING", viewportsNeeded: ["playing"],
    triggerDDS: false, captureInferences: false,
    serviceActions: [{ type: "enterPlay", seat }],
    resetPlay: true, chainedEvent: null, intermediatePhases: [],
  };
}

function resolveDeclinePlay(): TransitionDescriptor {
  return {
    targetPhase: "EXPLANATION", viewportsNeeded: ["explanation"],
    triggerDDS: false, captureInferences: false,
    serviceActions: [{ type: "declinePlay" }],
    resetPlay: false, chainedEvent: null, intermediatePhases: [],
  };
}

export function resolveTransition(_currentPhase: GamePhase, event: PhaseEvent): TransitionDescriptor {
  switch (event.type) {
    case "AUCTION_COMPLETE":
      return resolveAuctionComplete(event.servicePhase);
    case "PROMPT_ENTERED":
      return resolvePromptEntered(event.playPreference);
    case "ACCEPT_PLAY":
      return resolveAcceptPlay(event.seat);
    case "DECLINE_PLAY":
      return resolveDeclinePlay();
    case "SKIP_TO_REVIEW":
      return {
        targetPhase: "EXPLANATION", viewportsNeeded: ["explanation"],
        triggerDDS: false, captureInferences: false,
        serviceActions: [{ type: "skipToReview" }],
        resetPlay: false, chainedEvent: null, intermediatePhases: [],
      };
    case "PLAY_COMPLETE":
      return {
        targetPhase: "EXPLANATION", viewportsNeeded: ["explanation"],
        triggerDDS: true, captureInferences: false, serviceActions: [],
        resetPlay: false, chainedEvent: null, intermediatePhases: [],
      };
    case "PLAY_THIS_HAND":
      return {
        targetPhase: "PLAYING", viewportsNeeded: ["playing"],
        triggerDDS: false, captureInferences: false,
        serviceActions: [{ type: "returnToPrompt" }, { type: "enterPlay", seat: event.seat }],
        resetPlay: true, chainedEvent: null, intermediatePhases: ["DECLARER_PROMPT"],
      };
    case "RESTART_PLAY":
      return {
        targetPhase: "PLAYING", viewportsNeeded: ["playing"],
        triggerDDS: false, captureInferences: false,
        serviceActions: [{ type: "restartPlay" }],
        resetPlay: true, chainedEvent: null, intermediatePhases: [],
      };
    default:
      return noTransition();
  }
}

// ── Practice preferences ───────────────────────────────────────────

export interface DisplayPreferences {
  readonly showEducationalAnnotations: boolean;
}

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  showEducationalAnnotations: true,
};

export interface PracticePreferences {
  readonly baseSystemId: SystemSelectionId;
  readonly drill: DrillSettings;
  readonly display: DisplayPreferences;
}

export const DEFAULT_PRACTICE_PREFERENCES: PracticePreferences = {
  baseSystemId: "sayc",
  drill: DEFAULT_DRILL_SETTINGS,
  display: DEFAULT_DISPLAY_PREFERENCES,
};

// ── Strategy contract types (formerly in conventions/core/strategy-types.ts) ──

export interface BiddingContext {
  readonly hand: Hand;
  readonly auction: Auction;
  readonly seat: Seat;
  readonly evaluation: HandEvaluation;
  readonly vulnerability?: Vulnerability;
  readonly dealer?: Seat;
  readonly opponentConventionIds: readonly string[];
}

/** Encoder kind — mirrors ServiceEncoderKind for barrel convenience. */
export type EncoderKind =
  | "default-call"
  | "resolver"
  | "alternate-encoding"
  | "frontier-step"
  | "relay-map";

/** Convention contribution — used in teaching detail. */
export interface ConventionContribution {
  readonly moduleId: string;
  readonly role: "primary" | "alternative" | "suppressed";
  readonly meaningsProposed: readonly string[];
}

/** Parse tree view — used in teaching detail. */
export interface ParseTreeView {
  readonly modules: readonly ParseTreeModuleNode[];
  readonly selectedPath: {
    readonly moduleId: string;
    readonly meaningId: string;
    readonly call: Call;
  } | null;
}

interface ParseTreeModuleNode {
  readonly moduleId: string;
  readonly displayLabel: string;
  readonly verdict: "selected" | "applicable" | "eliminated";
  readonly conditions: readonly { readonly factId: string; readonly description: string; readonly satisfied: boolean; readonly observedValue?: unknown }[];
  readonly meanings: readonly { readonly meaningId: string; readonly displayLabel: string; readonly matched: boolean; readonly call?: Call }[];
  readonly eliminationReason?: string;
}

/** Teaching projection — full teaching data from pipeline evaluation. */
export interface TeachingProjection {
  readonly callViews: readonly { readonly call: Call; readonly status: "truth" | "acceptable" | "wrong"; readonly supportingMeanings: readonly string[]; readonly primaryMeaning?: string; readonly projectionKind: "single-rationale" | "merged-equivalent" | "multi-rationale-same-call" }[];
  readonly meaningViews: readonly { readonly meaningId: string; readonly semanticClassId?: string; readonly displayLabel: string; readonly status: "live" | "eliminated" | "not-applicable"; readonly eliminationReason?: string; readonly supportingEvidence: readonly unknown[] }[];
  readonly primaryExplanation: readonly { readonly kind: "text" | "condition" | "call-reference" | "convention-reference"; readonly content: string; readonly passed?: boolean; readonly explanationId?: string; readonly templateKey?: string }[];
  readonly whyNot: readonly { readonly call: Call; readonly grade: "near-miss" | "wrong"; readonly explanation: readonly { readonly kind: string; readonly content: string; readonly passed?: boolean }[]; readonly eliminationStage: string }[];
  readonly conventionsApplied: readonly ConventionContribution[];
  readonly handSpace: { readonly seatLabel: string; readonly hcpRange: { readonly min: number; readonly max: number }; readonly shapeDescription: string; readonly partnerSummary?: string; readonly archetypes?: readonly { readonly label: string; readonly hcpRange: { readonly min: number; readonly max: number }; readonly shapePattern: string }[] };
  readonly parseTree?: ParseTreeView;
  readonly evaluationExhaustive: boolean;
  readonly fallbackReached: boolean;
  readonly encoderKind?: EncoderKind;
}

/** Canonical factory for BiddingContext construction. */
export function createBiddingContext(params: {
  hand: Hand;
  auction: Auction;
  seat: Seat;
  evaluation: HandEvaluation;
  vulnerability?: Vulnerability;
  dealer?: Seat;
  opponentConventionIds?: readonly string[];
}): BiddingContext {
  return {
    hand: params.hand,
    auction: params.auction,
    seat: params.seat,
    evaluation: params.evaluation,
    vulnerability: params.vulnerability ?? Vulnerability.None,
    dealer: params.dealer ?? Seat.North,
    opponentConventionIds: params.opponentConventionIds ?? [],
  };
}

/** Posterior fact value — from inference/posterior. */
export interface PosteriorFactValue {
  readonly factId: string;
  readonly mean: number;
  readonly stdDev: number;
  readonly min: number;
  readonly max: number;
}

/** Posterior summary — from conventions/core/strategy-types. */
export interface PosteriorSummary {
  readonly factValues: readonly PosteriorFactValue[];
  readonly sampleCount: number;
  readonly confidence: number;
}

/** Bid result — strategy output. */
export interface BidResult {
  readonly call: Call;
  readonly ruleName: string | null;
  readonly explanation: string;
  readonly meaning?: string;
  readonly alert?: { readonly teachingLabel: string; readonly annotationType?: "alert" | "announce" | "educational" } | null;
  readonly handSummary?: string;
}

// ── Convention catalog type aliases ───────────────────────────────
// Re-exported so dev-params.ts can resolve convention/module IDs for URL params.
// All implementations delegate to BridgeService catalog methods.

/** Type alias for getConvention — delegates to BridgeService catalog. */
export type GetConventionFn = (id: string) => ConventionConfig;

/** Type alias for getModule — delegates to BridgeService catalog. */
export type GetModuleFn = (id: string) => unknown;
