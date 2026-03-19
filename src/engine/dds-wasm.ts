/**
 * DDS WASM integration — pure logic, no Worker/DOM dependencies.
 *
 * Handles PBN conversion and struct packing/unpacking for the DDS C++ library
 * compiled to WASM via Emscripten. Struct layouts from vendor/dds/include/dll.h (v2.9.0).
 */

import type { Deal, DDSolution, Seat, BidSuit } from "./types";
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
    const bySuit = new Map<Suit, string[]>([
      [Suit.Spades, []],
      [Suit.Hearts, []],
      [Suit.Diamonds, []],
      [Suit.Clubs, []],
    ]);

    for (const card of hand.cards) {
      bySuit.get(card.suit)!.push(RANK_CHARS[card.rank]);
    }

    // Sort each suit descending by rank
    const charToRank = new Map(
      Object.entries(RANK_CHARS).map(([r, c]) => [c, r as Rank]),
    );
    for (const suit of PBN_SUIT_ORDER) {
      bySuit.get(suit)!.sort(
        (a, b) => RANK_ORDER[charToRank.get(b)!] - RANK_ORDER[charToRank.get(a)!],
      );
    }

    return PBN_SUIT_ORDER.map((suit) => bySuit.get(suit)!.join("")).join(".");
  });

  return "N:" + hands.join(" ");
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
  _malloc(size: number): number;
  _free(ptr: number): void;
  getValue(ptr: number, type: string): number;
  setValue(ptr: number, value: number, type: string): void;
  stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number): void;
}

/**
 * Solve a deal using the DDS WASM module.
 * Allocates struct memory, calls CalcAllTablesPBN, unpacks results.
 * Par is always null (mode=-1 skips par calculation).
 *
 * Uses setValue/getValue/stringToUTF8 (exported by Emscripten) instead of
 * direct HEAPU8.buffer access — newer Emscripten builds do NOT expose the
 * HEAP typed-array views on the Module object.
 */
export function solveWithModule(
  module: DDSModule,
  deal: Deal,
): DDSolution {
  const pbn = dealToPBN(deal);

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
