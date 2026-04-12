import type {
  ReferenceContinuationPhase,
  ReferenceDecisionGrid,
  ReferenceInterferenceItem,
  ReferenceRelatedLink,
  ReferenceResponseTableRow,
  ReferenceSummaryCard,
  ReferenceSystemCompat,
  ReferenceWhenNotItem,
  ReferenceWorkedAuction,
} from "../../../shared/reference/types";
import { BidSuit, Seat } from "../../../../service";

export const summaryCardFixture: ReferenceSummaryCard = {
  trigger: "Partner opens 1NT, you respond",
  bid: { type: "bid", level: 2, strain: BidSuit.Clubs },
  promises: "At least one 4-card major.",
  denies: "A hand that is better handled by a direct transfer.",
  guidingIdea: "Use Stayman to uncover a 4-4 major fit before settling in notrump.",
  partnership: "On by default in SAYC; confirm variants before using over interference.",
};

export const whenToUseFixture: readonly string[] = [
  "Invite or force after a 1NT opening when you hold at least one 4-card major.",
  "Check for a major-suit fit before committing to 3NT.",
];

export const whenNotToUseFixture: readonly ReferenceWhenNotItem[] = [
  {
    text: "Do not use Stayman with 4-3-3-3 and a 4-card major",
    reason: "there is no ruffing value to justify searching for a thin fit",
  },
  {
    text: "Do not use Stayman when a transfer already describes the hand better",
    reason: "the transfer keeps the auction lower and better targeted",
  },
];

export const responseTableFixture: readonly ReferenceResponseTableRow[] = [
  {
    meaningId: "stayman:ask-major",
    response: { type: "bid", level: 2, strain: BidSuit.Diamonds },
    meaning: "No 4-card major.",
    shape: "Balanced or semibalanced without a 4-card major.",
    hcp: "15-17",
    forcing: "NF",
  },
  {
    meaningId: "stayman:heart-fit",
    response: { type: "bid", level: 2, strain: BidSuit.Hearts },
    meaning: "Four hearts, may also hold four spades.",
    shape: "4+ hearts.",
    hcp: "15-17",
    forcing: "INV",
  },
];

export const continuationPhasesFixture: readonly ReferenceContinuationPhase[] = [
  {
    phase: "response",
    phaseDisplay: "Response",
    turn: "opener",
    transitionLabel: "After 1NT-2♣, opener clarifies major-suit holdings.",
    surfaces: [
      {
        meaningId: "stayman:ask-major",
        teachingLabel: {
          name: "2♦ — no 4-card major",
          summary: "Opener denies a 4-card major.",
        },
        call: { type: "bid", level: 2, strain: BidSuit.Diamonds },
        recommendation: "should",
        disclosure: "standard",
        explanationText: "Responder now places the contract with invitational or game-forcing values.",
        clauses: [
          {
            factId: "shape-denial",
            operator: "==",
            description: "No 4-card major in opener's hand.",
            isPublic: true,
          },
        ],
      },
    ],
  },
  {
    phase: "continuation",
    phaseDisplay: "Continuation",
    turn: "responder",
    transitionLabel: null,
    surfaces: [
      {
        meaningId: "stayman:invite-notrump",
        teachingLabel: {
          name: "2NT — invite without a fit",
          summary: "Invite game after the 2♦ denial.",
        },
        call: { type: "bid", level: 2, strain: BidSuit.NoTrump },
        recommendation: "may",
        disclosure: "natural",
        explanationText: "Shows invitational values when responder found no major-suit fit.",
        clauses: [],
      },
    ],
  },
];

export const decisionGridFixture: ReferenceDecisionGrid = {
  rows: [{ label: "8-9 HCP" }, { label: "10+ HCP" }],
  cols: [{ label: "One 4-card major" }, { label: "Both 4-card majors" }],
  cells: [
    [
      {
        bid: { type: "bid", level: 2, strain: BidSuit.Clubs },
        meaning: "Use Stayman, then invite if opener denies.",
        family: "asking",
        note: "Invitational values only.",
      },
      {
        bid: { type: "bid", level: 2, strain: BidSuit.Clubs },
        meaning: "Stayman still starts the search for the best fit.",
        family: "asking",
      },
    ],
    [
      {
        bid: { type: "bid", level: 2, strain: BidSuit.Clubs },
        meaning: "Use Stayman and drive to game after the answer.",
        family: "force",
      },
      null,
    ],
  ],
};

export const workedAuctionFixture: ReferenceWorkedAuction = {
  label: "Main Line — find the heart fit",
  outcomeNote: "Responder lands in 4♥ after confirming the 4-4 fit.",
  calls: [
    {
      seat: Seat.South,
      call: { type: "bid", level: 2, strain: BidSuit.Clubs },
      rationale: "Responder asks opener to show a 4-card major.",
      meaningId: "stayman:ask-major",
    },
    {
      seat: Seat.North,
      call: { type: "bid", level: 2, strain: BidSuit.Hearts },
      rationale: "Opener shows four hearts.",
      meaningId: "stayman:heart-fit",
    },
    {
      seat: Seat.South,
      call: { type: "bid", level: 4, strain: BidSuit.Hearts },
      rationale: "Responder places the contract in game with the fit located.",
    },
  ],
};

export const interferenceFixture: readonly ReferenceInterferenceItem[] = [
  {
    opponentAction: "(2♦)",
    ourAction: { type: "pass" },
    note: "Pass with weak Stayman hands if systems are off.",
  },
];

export const systemCompatFixture: ReferenceSystemCompat = {
  sayc: "Standard Stayman over 1NT.",
  twoOverOne: "Often unchanged, but some pairs add game-forcing variants.",
  acol: "Thresholds move with the stronger notrump range.",
  customNote: "Document whether systems stay on after interference.",
};

export const relatedLinksFixture: readonly ReferenceRelatedLink[] = [
  {
    moduleId: "jacoby-transfers",
    discriminator: "asks for a major directly instead of asking whether opener has one",
  },
];
