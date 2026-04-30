import type {
  ReferenceBid,
  ReferenceResolvedCell,
  ReferenceForcingToken,
  ReferenceInterference,
  ReferenceResponseTable,
  ReferenceResponseTableRow,
  ReferenceView,
} from "../../../../components/shared/reference/types";

interface RouteResponseTableCell {
  columnId: string;
  columnLabel: string;
  text: string;
}

interface RouteResponseTableRow {
  meaningId: string;
  response: unknown;
  meaning: string;
  cells: readonly RouteResponseTableCell[];
}

interface RouteResponseTable {
  columns: readonly { id: string; label: string }[];
  rows: readonly RouteResponseTableRow[];
}

interface RouteWorkedAuctionCall {
  seat: string;
  call: unknown;
  rationale: string;
  meaningId?: string | null;
}

type RouteWorkedAuctionKind = "positive" | "negative";

interface RouteHandSample {
  spades: string;
  hearts: string;
  diamonds: string;
  clubs: string;
}

interface RouteResolvedAxis {
  label: string;
  values: readonly string[];
}

type RouteQuickReference =
  | {
      kind: "grid";
      rowAxis: RouteResolvedAxis;
      colAxis: RouteResolvedAxis;
      cells: readonly (readonly RouteResolvedCell[])[];
    }
  | {
      kind: "list";
      axis: RouteResolvedAxis;
      items: readonly { recommendation: string; note: string }[];
    };

interface RouteResolvedCell {
  call: string;
  gloss?: string;
  kind: ReferenceResolvedCell["kind"];
}

type RouteInterference =
  | {
      status: "applicable";
      items: readonly {
        opponentAction: string;
        ourAction: unknown;
        note: string;
      }[];
    }
  | { status: "notApplicable"; reason: string };

interface RouteSummaryCardPeer {
  meaningId: string;
  call: unknown;
  callDisplay: string;
  promises: string;
  denies: string;
  discriminatorLabel: string;
}

interface RouteSummaryCardStyleVariant {
  name: string;
  description: string;
}

interface RouteReferenceView {
  summaryCard: {
    trigger: string;
    bid: unknown;
    promises: string;
    denies: string;
    guidingIdea: string;
    agreementNote: string;
    styleVariants?: readonly RouteSummaryCardStyleVariant[];
    peers?: readonly RouteSummaryCardPeer[];
  };
  whenToUse: ReferenceView["whenToUse"];
  whenNotToUse: ReferenceView["whenNotToUse"];
  responseTable: RouteResponseTable;
  workedAuctions: readonly {
    kind?: RouteWorkedAuctionKind;
    label: string;
    calls: readonly RouteWorkedAuctionCall[];
    responderHand?: RouteHandSample | null;
  }[];
  interference: RouteInterference;
  quickReference: RouteQuickReference;
  relatedLinks: ReferenceView["relatedLinks"];
}

const FORCING_TOKENS = new Set<ReferenceForcingToken>([
  "NF",
  "INV",
  "F1",
  "GF",
]);

export function buildPracticeUrl(
  bundleIds: readonly string[],
  moduleId: string,
): string {
  const bundle = bundleIds[0] ?? "nt-bundle";
  return `/?convention=${encodeURIComponent(bundle)}&learn=${encodeURIComponent(moduleId)}`;
}

export function normalizeReferenceView(
  reference: RouteReferenceView,
): ReferenceView {
  return {
    summaryCard: {
      ...reference.summaryCard,
      bid: normalizeBid(reference.summaryCard.bid),
      styleVariants: (reference.summaryCard.styleVariants ?? []).map(
        (variant) => ({
          name: variant.name,
          description: variant.description,
        }),
      ),
      peers: (reference.summaryCard.peers ?? []).map((peer) => ({
        meaningId: peer.meaningId,
        call: normalizeBid(peer.call),
        callDisplay: peer.callDisplay,
        promises: peer.promises,
        denies: peer.denies,
        discriminatorLabel: peer.discriminatorLabel,
      })),
    },
    whenToUse: reference.whenToUse,
    whenNotToUse: reference.whenNotToUse,
    responseTable: normalizeResponseTable(reference.responseTable),
    workedAuctions: reference.workedAuctions.map((auction) => ({
      ...auction,
      kind: auction.kind ?? "positive",
      calls: auction.calls.map((entry) => ({
        ...entry,
        call: normalizeBid(entry.call),
        meaningId: entry.meaningId ?? null,
      })),
    })),
    interference: normalizeInterference(reference.interference),
    quickReference: reference.quickReference,
    relatedLinks: reference.relatedLinks,
  };
}

function normalizeResponseTable(
  table: RouteResponseTable,
): ReferenceResponseTable {
  return {
    columns: table.columns.map((c) => ({ id: c.id, label: c.label })),
    rows: table.rows.map(
      (row): ReferenceResponseTableRow => ({
        meaningId: row.meaningId,
        response: normalizeBid(row.response),
        meaning: row.meaning,
        cells: row.cells.map((cell) => ({
          columnId: cell.columnId,
          columnLabel: cell.columnLabel,
          text: cell.text,
        })),
      }),
    ),
  };
}

function normalizeInterference(
  interference: RouteInterference,
): ReferenceInterference {
  if (interference.status === "notApplicable") {
    return { status: "notApplicable", reason: interference.reason };
  }
  return {
    status: "applicable",
    items: interference.items.map((item) => ({
      opponentAction: item.opponentAction,
      ourAction: normalizeBid(item.ourAction),
      note: item.note,
    })),
  };
}

function normalizeBid(value: unknown): ReferenceBid {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null && "type" in value) {
    return value as ReferenceBid;
  }

  return String(value);
}

// Retained for potential downstream callers; no longer used by the normalizer itself.
export function isForcingToken(
  value: string | null,
): value is ReferenceForcingToken {
  return value !== null && FORCING_TOKENS.has(value as ReferenceForcingToken);
}
