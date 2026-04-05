/**
 * DDS WASM integration — pure logic, no Worker/DOM dependencies.
 *
 * Handles PBN conversion and struct packing/unpacking for the DDS C++ library
 * compiled to WASM via Emscripten. Struct layouts from vendor/dds/include/dll.h (v2.9.0).
 */

import type { Deal, DDSolution, Seat, BidSuit, Hand, Card } from "./types";
import {
  Seat as SeatEnum,
  Suit,
  Rank,
  BidSuit as BidSuitEnum,
} from "./types";

// -- DDS struct constants from dll.h (v2.9.0) --
// struct ddTableDealPBN { char cards[80]; } → 80 bytes
// struct ddTableDealsPBN { int noOfTables; struct ddTableDealPBN deals[MAXNOOFTABLES * DDS_STRAINS]; }
// MAXNOOFTABLES=40, DDS_STRAINS=5 → 200 deals max
// Total: 4 + 200*80 = 16004 bytes
const DEALS_PBN_SIZE = 16004;

// struct ddTableResults { int resTable[DDS_STRAINS][DDS_HANDS]; } → 5*4*4 = 80 bytes
// struct ddTablesRes { int noOfBoards; struct ddTableResults results[200]; }
// Total: 4 + 200*80 = 16004 bytes
const TABLES_RES_SIZE = 16004;

// struct allParResults { struct parResults presults[40]; }
// struct parResults { char parScore[2][16]; char parContractsString[2][128]; } = 288 bytes
// Total: 40 * 288 = 11520 bytes
const ALL_PAR_SIZE = 11520;

// DDS return code for success (dll.h)
const RETURN_NO_FAULT = 1;

// Rank characters in DDS PBN format, descending order
const RANK_CHARS: Record<Rank, string> = {
  [Rank.Ace]: "A",
  [Rank.King]: "K",
  [Rank.Queen]: "Q",
  [Rank.Jack]: "J",
  [Rank.Ten]: "T",
  [Rank.Nine]: "9",
  [Rank.Eight]: "8",
  [Rank.Seven]: "7",
  [Rank.Six]: "6",
  [Rank.Five]: "5",
  [Rank.Four]: "4",
  [Rank.Three]: "3",
  [Rank.Two]: "2",
};

// Rank ordering for descending sort
const RANK_ORDER: Record<Rank, number> = {
  [Rank.Ace]: 14,
  [Rank.King]: 13,
  [Rank.Queen]: 12,
  [Rank.Jack]: 11,
  [Rank.Ten]: 10,
  [Rank.Nine]: 9,
  [Rank.Eight]: 8,
  [Rank.Seven]: 7,
  [Rank.Six]: 6,
  [Rank.Five]: 5,
  [Rank.Four]: 4,
  [Rank.Three]: 3,
  [Rank.Two]: 2,
};

// DDS strain index mapping (dll.h): 0=S, 1=H, 2=D, 3=C, 4=NT
const DDS_STRAIN_MAP: BidSuit[] = [
  BidSuitEnum.Spades,
  BidSuitEnum.Hearts,
  BidSuitEnum.Diamonds,
  BidSuitEnum.Clubs,
  BidSuitEnum.NoTrump,
];

// DDS seat index mapping (dll.h): 0=N, 1=E, 2=S, 3=W
const DDS_SEAT_MAP: Seat[] = [
  SeatEnum.North,
  SeatEnum.East,
  SeatEnum.South,
  SeatEnum.West,
];

// Suit order for PBN: S.H.D.C
const PBN_SUIT_ORDER = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs];

// Seat order for PBN: N E S W
const PBN_SEAT_ORDER = [
  SeatEnum.North,
  SeatEnum.East,
  SeatEnum.South,
  SeatEnum.West,
];

/**
 * Convert a Deal to DDS PBN format string.
 * Output: "N:AK.QJT98.765.432 QJ.K654.AK43.765 T987.32.QJ2.AT98 6543.A7.T98.KQJ2"
 * Seats ordered N E S W, suits ordered S.H.D.C, ranks descending.
 */
export function dealToPBN(deal: Deal): string {
  const hands = PBN_SEAT_ORDER.map((seat) => {
    const hand = deal.hands[seat];
    return cardsToPBNHand(hand.cards);
  });

  return "N:" + hands.join(" ");
}

/**
 * Convert remaining hands to DDS PBN format string.
 * Accepts partial hands (<13 cards) for mid-play positions.
 * Hands with no cards produce empty suit strings.
 * Output: "N:AK.QT.7.2 QJ.K6.A4.75 T9.3.QJ.AT J5.A7.T9.KQ"
 */
export function handsToPBN(hands: Record<Seat, Hand>): string {
  const handStrs = PBN_SEAT_ORDER.map((seat) => {
    const hand = hands[seat];
    return cardsToPBNHand(hand.cards);
  });
  return "N:" + handStrs.join(" ");
}

/** Convert a set of cards to a PBN hand string (S.H.D.C ranks descending). */
function cardsToPBNHand(cards: readonly Card[]): string {
  const bySuit = new Map<Suit, string[]>([
    [Suit.Spades, []],
    [Suit.Hearts, []],
    [Suit.Diamonds, []],
    [Suit.Clubs, []],
  ]);

  for (const card of cards) {
    bySuit.get(card.suit)!.push(RANK_CHARS[card.rank]);
  }

  const charToRank = new Map(
    Object.entries(RANK_CHARS).map(([r, c]) => [c, r as Rank]),
  );
  for (const suit of PBN_SUIT_ORDER) {
    bySuit.get(suit)!.sort(
      (a, b) => RANK_ORDER[charToRank.get(b)!] - RANK_ORDER[charToRank.get(a)!],
    );
  }

  return PBN_SUIT_ORDER.map((suit) => bySuit.get(suit)!.join("")).join(".");
}

/** Map Suit to DDS suit index (0=S, 1=H, 2=D, 3=C). */
export function suitToDdsIndex(suit: Suit): number {
  return DDS_SUIT_MAP_PLAY.indexOf(suit);
}

/** Map trump Suit|undefined to DDS strain index (0=S, 1=H, 2=D, 3=C, 4=NT). */
export function trumpToDdsIndex(trumpSuit: Suit | undefined): number {
  if (trumpSuit === undefined) return 4; // NT
  return suitToDdsIndex(trumpSuit);
}

/** Map Seat to DDS seat index (N=0, E=1, S=2, W=3). */
export function seatToDdsIndex(seat: Seat): number {
  return DDS_SEAT_MAP.indexOf(seat);
}

/** Map Rank to DDS rank value (2-14). */
export function rankToDdsValue(rank: Rank): number {
  return RANK_ORDER[rank];
}

/**
 * Pack a PBN string into the ddTableDealsPBN struct layout.
 * Writes noOfTables=1 at byte 0, PBN string at byte 4.
 */
export function packDealsPBN(pbn: string, view: DataView): void {
  view.setInt32(0, 1, true); // noOfTables = 1, little-endian
  for (let i = 0; i < pbn.length; i++) {
    view.setUint8(4 + i, pbn.charCodeAt(i));
  }
  // Null-terminate
  view.setUint8(4 + pbn.length, 0);
}

/**
 * Unpack ddTableResults from a DataView at the given byte offset.
 * resTable[strain][seat] — 5 strains × 4 seats, each int32.
 * Returns Record<Seat, Record<BidSuit, number>>.
 */
export function unpackResults(
  view: DataView,
  offset: number,
): Record<Seat, Record<BidSuit, number>> {
  const result = {} as Record<Seat, Record<BidSuit, number>>;

  for (const seat of DDS_SEAT_MAP) {
    result[seat] = {} as Record<BidSuit, number>;
  }

  for (let strainIdx = 0; strainIdx < 5; strainIdx++) {
    const strain = DDS_STRAIN_MAP[strainIdx]!;
    for (let seatIdx = 0; seatIdx < 4; seatIdx++) {
      const seat = DDS_SEAT_MAP[seatIdx]!;
      const byteOffset = offset + (strainIdx * 4 + seatIdx) * 4;
      const tricks = view.getInt32(byteOffset, true);
      result[seat][strain] = tricks;
    }
  }

  return result;
}

// ── SolveBoard struct constants from dll.h ──────────────────────────
// struct dealPBN: int trump(4) + int first(4) + int currentTrickSuit[3](12) +
//                 int currentTrickRank[3](12) + char remainCards[80] = 112 bytes
const DEAL_PBN_SIZE = 112;

// struct futureTricks: int nodes(4) + int cards(4) + int suit[13](52) +
//                      int rank[13](52) + int equals[13](52) + int score[13](52) = 216 bytes
const FUTURE_TRICKS_SIZE = 216;

// DDS suit index mapping for play: 0=S, 1=H, 2=D, 3=C
const DDS_SUIT_MAP_PLAY: Suit[] = [
  Suit.Spades,
  Suit.Hearts,
  Suit.Diamonds,
  Suit.Clubs,
];

// DDS rank value to Rank enum (2-14)
const DDS_RANK_MAP: Record<number, Rank> = {
  2: Rank.Two,
  3: Rank.Three,
  4: Rank.Four,
  5: Rank.Five,
  6: Rank.Six,
  7: Rank.Seven,
  8: Rank.Eight,
  9: Rank.Nine,
  10: Rank.Ten,
  11: Rank.Jack,
  12: Rank.Queen,
  13: Rank.King,
  14: Rank.Ace,
};

/** Result of SolveBoard — per-card optimal trick counts. */
export interface SolveBoardResult {
  readonly cards: ReadonlyArray<{
    readonly suit: Suit;
    readonly rank: Rank;
    readonly score: number;
    readonly equals: number;
  }>;
}

/** Emscripten module interface for DDS WASM. */
export interface DDSModule {
  _SetResources(maxMemoryMB: number, maxThreads: number): void;
  _CalcAllTablesPBN(
    dealsPtr: number,
    mode: number,
    filterPtr: number,
    resPtr: number,
    parPtr: number,
  ): number;
  _SolveBoardPBN(
    dealPtr: number,
    target: number,
    solutions: number,
    mode: number,
    futPtr: number,
    thrId: number,
  ): number;
  _malloc(size: number): number;
  _free(ptr: number): void;
  getValue(ptr: number, type: string): number;
  setValue(ptr: number, value: number, type: string): void;
  stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number): void;
}

/**
 * Solve a deal from a PBN string using the DDS WASM module.
 * Allocates struct memory, calls CalcAllTablesPBN, unpacks results.
 * Par is always null (mode=-1 skips par calculation).
 *
 * Uses setValue/getValue/stringToUTF8 (exported by Emscripten) instead of
 * direct HEAPU8.buffer access — newer Emscripten builds do NOT expose the
 * HEAP typed-array views on the Module object.
 */
export function solveFromPBN(
  module: DDSModule,
  pbn: string,
): DDSolution {
  // Allocate structs on WASM heap
  const dealsPtr = module._malloc(DEALS_PBN_SIZE);
  const filterPtr = module._malloc(5 * 4); // int[5] trump filter
  const resPtr = module._malloc(TABLES_RES_SIZE);
  const parPtr = module._malloc(ALL_PAR_SIZE);

  try {
    // Pack ddTableDealsPBN: { int noOfTables; struct ddTableDealPBN deals[...]; }
    module.setValue(dealsPtr, 1, "i32"); // noOfTables = 1
    module.stringToUTF8(pbn, dealsPtr + 4, 80); // PBN string (null-terminated)

    // Trump filter: all zeros = solve all 5 strains
    for (let i = 0; i < 5; i++) {
      module.setValue(filterPtr + i * 4, 0, "i32");
    }

    // Zero results (int32-aligned)
    for (let i = 0; i < TABLES_RES_SIZE; i += 4) {
      module.setValue(resPtr + i, 0, "i32");
    }

    // Call DDS
    const ret = module._CalcAllTablesPBN(
      dealsPtr,
      -1, // mode=-1: no par calculation
      filterPtr,
      resPtr,
      parPtr,
    );

    if (ret !== RETURN_NO_FAULT) {
      throw new Error(`DDS CalcAllTablesPBN failed with code ${ret}`);
    }

    // Unpack results via getValue — skip noOfBoards (4 bytes at resPtr)
    // resTable[strain][seat] — 5 strains × 4 seats, each int32.
    const tricks = {} as Record<Seat, Record<BidSuit, number>>;
    for (const seat of DDS_SEAT_MAP) {
      tricks[seat] = {} as Record<BidSuit, number>;
    }
    for (let strainIdx = 0; strainIdx < 5; strainIdx++) {
      const strain = DDS_STRAIN_MAP[strainIdx]!;
      for (let seatIdx = 0; seatIdx < 4; seatIdx++) {
        const seat = DDS_SEAT_MAP[seatIdx]!;
        const addr = resPtr + 4 + (strainIdx * 4 + seatIdx) * 4;
        tricks[seat][strain] = module.getValue(addr, "i32");
      }
    }

    return { tricks, par: null };
  } finally {
    module._free(dealsPtr);
    module._free(filterPtr);
    module._free(resPtr);
    module._free(parPtr);
  }
}

/**
 * Solve a deal using the DDS WASM module.
 * Converts the Deal to PBN format and delegates to solveFromPBN.
 */
export function solveWithModule(
  module: DDSModule,
  deal: Deal,
): DDSolution {
  return solveFromPBN(module, dealToPBN(deal));
}

// ── SolveBoard ──────────────────────────────────────────────────────

/**
 * Solve a board position — returns per-card trick counts for all legal plays.
 *
 * @param trump             Trump suit index (0=S, 1=H, 2=D, 3=C, 4=NT)
 * @param first             Seat on lead (0=N, 1=E, 2=S, 3=W)
 * @param currentTrickSuit  Suits of cards already played this trick (up to 3)
 * @param currentTrickRank  Ranks (2-14) of cards already played this trick
 * @param remainCardsPBN    PBN string of remaining cards in all hands
 */
export function solveBoardWithModule(
  module: DDSModule,
  trump: number,
  first: number,
  currentTrickSuit: number[],
  currentTrickRank: number[],
  remainCardsPBN: string,
): SolveBoardResult {
  const dealPtr = module._malloc(DEAL_PBN_SIZE);
  const futPtr = module._malloc(FUTURE_TRICKS_SIZE);
  try {
    // Pack dealPBN struct
    module.setValue(dealPtr, trump, "i32");           // trump
    module.setValue(dealPtr + 4, first, "i32");       // first (seat on lead)
    for (let i = 0; i < 3; i++) {
      module.setValue(dealPtr + 8 + i * 4, currentTrickSuit[i] ?? 0, "i32");
      module.setValue(dealPtr + 20 + i * 4, currentTrickRank[i] ?? 0, "i32");
    }
    module.stringToUTF8(remainCardsPBN, dealPtr + 32, 80);

    // Zero futureTricks struct
    for (let i = 0; i < FUTURE_TRICKS_SIZE; i += 4) {
      module.setValue(futPtr + i, 0, "i32");
    }

    // target=-1: find all optimal plays
    // solutions=3: return ALL legal cards with their scores
    // mode=1: reuse TT from previous solves
    // thrId=0: single-threaded WASM
    const ret = module._SolveBoardPBN(dealPtr, -1, 3, 1, futPtr, 0);
    if (ret !== RETURN_NO_FAULT) {
      throw new Error(`DDS SolveBoardPBN failed with code ${ret}`);
    }

    // Unpack futureTricks struct
    // Layout: nodes(4) + cards(4) + suit[13](52) + rank[13](52) + equals[13](52) + score[13](52)
    const numCards = module.getValue(futPtr + 4, "i32");
    const cards: SolveBoardResult["cards"][number][] = [];
    for (let i = 0; i < numCards; i++) {
      const suitIdx = module.getValue(futPtr + 8 + i * 4, "i32");
      const rankVal = module.getValue(futPtr + 60 + i * 4, "i32");   // rank at offset 8+52=60
      const equals = module.getValue(futPtr + 112 + i * 4, "i32");   // equals at offset 60+52=112
      const score = module.getValue(futPtr + 164 + i * 4, "i32");    // score at offset 112+52=164

      const suit = DDS_SUIT_MAP_PLAY[suitIdx];
      const rank = DDS_RANK_MAP[rankVal];
      if (suit !== undefined && rank !== undefined) {
        cards.push({ suit, rank, score, equals });
      }
    }
    return { cards };
  } finally {
    module._free(dealPtr);
    module._free(futPtr);
  }
}
