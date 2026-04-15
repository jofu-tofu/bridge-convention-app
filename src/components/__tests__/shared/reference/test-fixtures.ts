import type {
  ReferenceInterference,
  ReferencePredicateBullet,
  ReferenceQuickReference,
  ReferenceRelatedLink,
  ReferenceResponseTable,
  ReferenceSummaryCard,
  ReferenceWhenNotItem,
  ReferenceWorkedAuction,
} from "../../../shared/reference/types";
import type { ModuleFlowTreeViewport } from "../../../../service";
import { BidSuit, Seat } from "../../../../service";

export const summaryCardFixture: ReferenceSummaryCard = {
  trigger: "Partner opens 1NT, you respond",
  bid: { type: "bid", level: 2, strain: BidSuit.Clubs },
  promises: "At least one 4-card major.",
  denies: "A hand that is better handled by a direct transfer.",
  guidingIdea:
    "Use Stayman to uncover a 4-4 major fit before settling in notrump.",
  partnership: "Confirm variants before using over interference.",
  peers: [],
};

export const whenToUseFixture: readonly ReferencePredicateBullet[] = [
  {
    predicate: {
      kind: "extended",
      clause: {
        clauseKind: "booleanFact",
        fact_id: "system.responder.inviteValues",
        expected: true,
      },
    },
    gloss:
      "Invite or force after a 1NT opening when you hold at least one 4-card major.",
    predicateText:
      "Responder has invitational-or-better values and at least one 4-card major.",
  },
  {
    predicate: {
      kind: "extended",
      clause: {
        clauseKind: "booleanFact",
        fact_id: "system.responder.gameValues",
        expected: true,
      },
    },
    gloss: "Check for a major-suit fit before committing to 3NT.",
    predicateText:
      "Responder has game-going values and wants to compare notrump with a major-suit fit.",
  },
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

export const responseTableFixture: ReferenceResponseTable = {
  columns: [
    { id: "shape", label: "Shape" },
    { id: "hcp", label: "HCP" },
  ],
  rows: [
    {
      meaningId: "stayman:ask-major",
      response: { type: "bid", level: 2, strain: BidSuit.Diamonds },
      meaning: "No 4-card major.",
      cells: [
        {
          columnId: "shape",
          columnLabel: "Shape",
          text: "Balanced without a 4-card major.",
        },
        { columnId: "hcp", columnLabel: "HCP", text: "15-17" },
      ],
    },
    {
      meaningId: "stayman:heart-fit",
      response: { type: "bid", level: 2, strain: BidSuit.Hearts },
      meaning: "Four hearts, may also hold four spades.",
      cells: [
        { columnId: "shape", columnLabel: "Shape", text: "4+ hearts." },
        { columnId: "hcp", columnLabel: "HCP", text: "15-17" },
      ],
    },
  ],
};

export const flowTreeFixture: ModuleFlowTreeViewport = {
  moduleId: "stayman",
  moduleName: "Stayman",
  nodeCount: 4,
  maxDepth: 2,
  root: {
    id: "stayman:root:0",
    call: { type: "bid", level: 1, strain: BidSuit.NoTrump },
    callDisplay: "1NT",
    turn: "opener",
    label: "Partner opened 1NT",
    moduleId: "stayman",
    moduleDisplayName: "Stayman",
    meaningId: null,
    depth: 0,
    recommendation: null,
    disclosure: null,
    explanationText: null,
    clauses: [],
    children: [
      {
        id: "stayman:ask:1",
        call: { type: "bid", level: 2, strain: BidSuit.Clubs },
        callDisplay: "2C",
        turn: "responder",
        label: "Stayman 2♣",
        moduleId: "stayman",
        moduleDisplayName: "Stayman",
        meaningId: "stayman:ask-major",
        depth: 1,
        recommendation: "should",
        disclosure: "standard",
        explanationText: "Asks opener to show a 4-card major.",
        clauses: [],
        children: [
          {
            id: "stayman:2d:2",
            call: { type: "bid", level: 2, strain: BidSuit.Diamonds },
            callDisplay: "2D",
            turn: "opener",
            label: "Deny major (2♦)",
            moduleId: "stayman",
            moduleDisplayName: "Stayman",
            meaningId: "stayman:deny-major",
            depth: 2,
            recommendation: "must",
            disclosure: "standard",
            explanationText: "No 4-card major in opener's hand.",
            clauses: [],
            children: [],
          },
          {
            id: "stayman:2h:3",
            call: { type: "bid", level: 2, strain: BidSuit.Hearts },
            callDisplay: "2H",
            turn: "opener",
            label: "Show hearts",
            moduleId: "stayman",
            moduleDisplayName: "Stayman",
            meaningId: "stayman:heart-fit",
            depth: 2,
            recommendation: "must",
            disclosure: "standard",
            explanationText: null,
            clauses: [],
            children: [],
          },
        ],
      },
    ],
  },
};

export const quickReferenceGridFixture: ReferenceQuickReference = {
  kind: "grid",
  rowAxis: {
    label: "Responder strength",
    values: ["8-9 HCP", "10+ HCP"],
  },
  colAxis: {
    label: "Shape",
    values: ["One 4-card major", "Both 4-card majors"],
  },
  cells: [
    [
      {
        call: "2♣",
        gloss: "Ask, then invite",
        kind: "action",
      },
      {
        call: "2♣",
        gloss: "Ask, then invite via the other major",
        kind: "action",
      },
    ],
    [
      {
        call: "2♣",
        gloss: "Ask, then bid game",
        kind: "action",
      },
      {
        call: "—",
        kind: "notApplicable",
        notApplicableReasonText:
          "Both 4-card majors with game values are shown through the Smolen branch instead.",
      },
    ],
  ],
};

export const quickReferenceDenseGridFixture: ReferenceQuickReference = {
  kind: "grid",
  rowAxis: {
    label: "Responder strength",
    values: ["Weak", "Invite", "Game force"],
  },
  colAxis: {
    label: "Shape",
    values: ["No major", "One 4-card major", "Both majors"],
  },
  cells: [
    [
      {
        call: "—",
        kind: "notApplicable",
        notApplicableReasonText:
          "Weak hands sign off or transfer instead of using Stayman.",
      },
      {
        call: "—",
        kind: "notApplicable",
        notApplicableReasonText:
          "Weak hands sign off or transfer instead of using Stayman.",
      },
      {
        call: "—",
        kind: "notApplicable",
        notApplicableReasonText:
          "Weak hands sign off or transfer instead of using Stayman.",
      },
    ],
    [
      {
        call: "—",
        kind: "notApplicable",
        notApplicableReasonText: "Invites without a major stay in notrump.",
      },
      { call: "2♣", gloss: "Ask, then invite over 2♦/2♥/2♠", kind: "action" },
      {
        call: "—",
        kind: "notApplicable",
        notApplicableReasonText:
          "5-4 majors route through Smolen after the Stayman ask.",
      },
    ],
    [
      {
        call: "—",
        kind: "notApplicable",
        notApplicableReasonText: "Game forces without a major stay in notrump.",
      },
      {
        call: "2♣",
        gloss: "Ask, then place game in the best strain",
        kind: "action",
      },
      {
        call: "—",
        kind: "notApplicable",
        notApplicableReasonText:
          "5-4 majors route through Smolen after the Stayman ask.",
      },
    ],
  ],
};

export const quickReferenceListFixture: ReferenceQuickReference = {
  kind: "list",
  axis: {
    label: "Keycards held",
    values: ["0 or 3", "1 or 4", "2 without trump queen", "2 with trump queen"],
  },
  items: [
    { recommendation: "5C", note: "" },
    { recommendation: "5D", note: "" },
    { recommendation: "5H", note: "" },
    { recommendation: "5S", note: "" },
  ],
};

export const workedAuctionFixture: ReferenceWorkedAuction = {
  kind: "positive",
  label: "Main Line — find the heart fit",
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

export const workedAuctionWithHandFixture: ReferenceWorkedAuction = {
  ...workedAuctionFixture,
  responderHand: {
    spades: "K97",
    hearts: "AJ53",
    diamonds: "Q64",
    clubs: "K82",
  },
};

export const interferenceApplicableFixture: ReferenceInterference = {
  status: "applicable",
  items: [
    {
      opponentAction: "(2♦)",
      ourAction: { type: "pass" },
      note: "Pass with weak Stayman hands if systems are off.",
    },
  ],
};

export const interferenceNotApplicableFixture: ReferenceInterference = {
  status: "notApplicable",
  reason: "slam-zone ask with no standard opponent overcall",
};

export const relatedLinksFixture: readonly ReferenceRelatedLink[] = [
  {
    moduleId: "jacoby-transfers",
    discriminator:
      "asks for a major directly instead of asking whether opener has one",
  },
];
