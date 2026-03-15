import { describe, it, expect } from "vitest";
import type {
  FactorSpec,
  HcpRangeFactor,
  SuitLengthFactor,
  ShapeFactor,
  ExclusionFactor,
  FitFactor,
  FactorGraphIR,
  FactorOrigin,
  EvidencePin,
  OwnHandPin,
  AuctionRecordPin,
  AlertPin,
  AmbiguityFamilyIR,
} from "../factor-graph";
import { Suit, Rank } from "../../../engine/types";
import type { Hand } from "../../../engine/types";

// ─── Helpers ────────────────────────────────────────────────
const origin: FactorOrigin = {
  originKind: "call-meaning",
  sourceMeaning: "stayman:ask-major",
  sourceModule: "stayman",
};

const hand: Hand = {
  cards: [
    { suit: Suit.Spades, rank: Rank.Ace },
    { suit: Suit.Hearts, rank: Rank.King },
  ],
};

// ─── FactorSpec variants ────────────────────────────────────
describe("FactorSpec discriminated union", () => {
  it("can construct HcpRangeFactor with all required fields", () => {
    const factor: HcpRangeFactor = {
      kind: "hcp-range",
      seat: "N",
      min: 12,
      max: 14,
      strength: "hard",
      origin,
    };

    expect(factor.kind).toBe("hcp-range");
    expect(factor.seat).toBe("N");
    expect(factor.min).toBe(12);
    expect(factor.max).toBe(14);
    expect(factor.strength).toBe("hard");
    expect(factor.origin.originKind).toBe("call-meaning");
  });

  it("can construct SuitLengthFactor with all required fields", () => {
    const factor: SuitLengthFactor = {
      kind: "suit-length",
      seat: "S",
      suit: "H",
      min: 5,
      max: 7,
      strength: "soft",
      origin,
    };

    expect(factor.kind).toBe("suit-length");
    expect(factor.suit).toBe("H");
    expect(factor.min).toBe(5);
    expect(factor.max).toBe(7);
  });

  it("can construct ShapeFactor with all required fields", () => {
    const factor: ShapeFactor = {
      kind: "shape",
      seat: "E",
      pattern: "balanced",
      strength: "hard",
      origin,
    };

    expect(factor.kind).toBe("shape");
    expect(factor.pattern).toBe("balanced");
  });

  it("can construct ExclusionFactor with all required fields", () => {
    const factor: ExclusionFactor = {
      kind: "exclusion",
      seat: "W",
      constraint: "no five-card major",
      strength: "hard",
      origin,
    };

    expect(factor.kind).toBe("exclusion");
    expect(factor.constraint).toBe("no five-card major");
  });

  it("can construct FitFactor with all required fields", () => {
    const factor: FitFactor = {
      kind: "fit",
      seats: ["N", "S"],
      suit: "S",
      minCombined: 8,
      strength: "soft",
      origin,
    };

    expect(factor.kind).toBe("fit");
    expect(factor.seats).toEqual(["N", "S"]);
    expect(factor.minCombined).toBe(8);
  });

  it("supports exhaustive switch on kind discriminant", () => {
    const factors: FactorSpec[] = [
      { kind: "hcp-range", seat: "N", min: 12, max: 14, strength: "hard", origin },
      { kind: "suit-length", seat: "N", suit: "S", min: 4, max: 6, strength: "hard", origin },
      { kind: "shape", seat: "N", pattern: "balanced", strength: "hard", origin },
      { kind: "exclusion", seat: "N", constraint: "none", strength: "hard", origin },
      { kind: "fit", seats: ["N", "S"], suit: "H", minCombined: 8, strength: "soft", origin },
    ];

    const kinds = factors.map((f) => {
      switch (f.kind) {
        case "hcp-range":
          return f.min;
        case "suit-length":
          return f.suit;
        case "shape":
          return f.pattern;
        case "exclusion":
          return f.constraint;
        case "fit":
          return f.minCombined;
      }
      // TypeScript exhaustiveness: the above should cover all cases
    });

    expect(kinds).toEqual([12, "S", "balanced", "none", 8]);
  });
});

// ─── EvidencePin discriminated union ────────────────────────
describe("EvidencePin discriminated union", () => {
  it("can construct OwnHandPin", () => {
    const pin: OwnHandPin = {
      kind: "own-hand",
      seat: "S",
      hand,
    };

    expect(pin.kind).toBe("own-hand");
    expect(pin.hand.cards).toHaveLength(2);
  });

  it("can construct AuctionRecordPin", () => {
    const pin: AuctionRecordPin = {
      kind: "auction-record",
      events: [
        { eventIndex: 0, call: "1NT", seat: "N" },
        { eventIndex: 1, call: "2C", seat: "S", alert: "Stayman" },
      ],
    };

    expect(pin.kind).toBe("auction-record");
    expect(pin.events).toHaveLength(2);
    expect(pin.events[0]!.call).toBe("1NT");
  });

  it("can construct AlertPin", () => {
    const pin: AlertPin = {
      kind: "alert",
      seat: "N",
      message: "Forcing",
    };

    expect(pin.kind).toBe("alert");
    expect(pin.message).toBe("Forcing");
  });

  it("supports exhaustive switch on kind discriminant", () => {
    const pins: EvidencePin[] = [
      { kind: "own-hand", seat: "S", hand },
      { kind: "auction-record", events: [] },
      { kind: "alert", seat: "N", message: "Alert" },
    ];

    const kinds = pins.map((p) => {
      switch (p.kind) {
        case "own-hand":
          return p.hand;
        case "auction-record":
          return p.events;
        case "alert":
          return p.message;
      }
    });

    expect(kinds).toHaveLength(3);
  });
});

// ─── FactorGraphIR ──────────────────────────────────────────
describe("FactorGraphIR", () => {
  it("can be constructed with all fields", () => {
    const fg: FactorGraphIR = {
      factors: [
        { kind: "hcp-range", seat: "N", min: 15, max: 17, strength: "hard", origin },
      ],
      ambiguitySchema: [
        {
          familyId: "1NT-response",
          alternatives: [
            { branchId: "stayman", meaningId: "stayman:ask", description: "Stayman inquiry" },
            { branchId: "transfer", meaningId: "jacoby:transfer", description: "Jacoby transfer" },
          ],
          exclusivity: "xor",
        },
      ],
      evidencePins: [
        { kind: "own-hand", seat: "S", hand },
      ],
      compilationTrace: [origin],
    };

    expect(fg.factors).toHaveLength(1);
    expect(fg.ambiguitySchema).toHaveLength(1);
    expect(fg.evidencePins).toHaveLength(1);
    expect(fg.compilationTrace).toHaveLength(1);
  });

  it("empty factor graph is valid", () => {
    const fg: FactorGraphIR = {
      factors: [],
      ambiguitySchema: [],
      evidencePins: [],
      compilationTrace: [],
    };

    expect(fg.factors).toHaveLength(0);
    expect(fg.ambiguitySchema).toHaveLength(0);
    expect(fg.evidencePins).toHaveLength(0);
    expect(fg.compilationTrace).toHaveLength(0);
  });

  it("round-trips through JSON serialization without loss", () => {
    const fg: FactorGraphIR = {
      factors: [
        { kind: "hcp-range", seat: "N", min: 15, max: 17, strength: "hard", origin },
        { kind: "suit-length", seat: "S", suit: "H", min: 5, max: 7, strength: "soft", origin },
        { kind: "shape", seat: "E", pattern: "semi-balanced", strength: "hard", origin },
        { kind: "exclusion", seat: "W", constraint: "no void", strength: "hard", origin },
        { kind: "fit", seats: ["N", "S"], suit: "S", minCombined: 8, strength: "soft", origin },
      ],
      ambiguitySchema: [
        {
          familyId: "response-family",
          alternatives: [
            { branchId: "a", meaningId: "m1", description: "Branch A" },
            { branchId: "b", meaningId: "m2", description: "Branch B" },
          ],
          exclusivity: "or",
        },
      ],
      evidencePins: [
        { kind: "own-hand", seat: "S", hand },
        { kind: "auction-record", events: [{ eventIndex: 0, call: "1NT", seat: "N" }] },
        { kind: "alert", seat: "N", message: "Forcing" },
      ],
      compilationTrace: [
        origin,
        { originKind: "announcement", sourceModule: "jacoby" },
      ],
    };

    const serialized = JSON.stringify(fg);
    const deserialized = JSON.parse(serialized) as FactorGraphIR;

    expect(deserialized).toEqual(fg);
    expect(deserialized.factors).toHaveLength(5);
    expect(deserialized.ambiguitySchema[0]!.exclusivity).toBe("or");
    expect(deserialized.evidencePins).toHaveLength(3);
    expect(deserialized.compilationTrace).toHaveLength(2);
  });
});
