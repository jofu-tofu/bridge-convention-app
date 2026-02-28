import { describe, it, expect, vi, beforeEach } from "vitest";
import { Seat } from "../types";
import type { Deal } from "../types";

const mockInit = vi.fn().mockResolvedValue(undefined);
const mockGenerateDeal = vi.fn();
const mockEvaluateHand = vi.fn();
const mockGetSuitLength = vi.fn();
const mockIsBalanced = vi.fn();
const mockGetLegalCalls = vi.fn();
const mockAddCall = vi.fn();
const mockIsAuctionComplete = vi.fn();
const mockGetContract = vi.fn();
const mockCalculateScore = vi.fn();
const mockGetLegalPlays = vi.fn();
const mockGetTrickWinner = vi.fn();

vi.mock("bridge-wasm", () => ({
  default: mockInit,
  generate_deal: mockGenerateDeal,
  evaluate_hand: mockEvaluateHand,
  get_suit_length: mockGetSuitLength,
  is_balanced: mockIsBalanced,
  get_legal_calls: mockGetLegalCalls,
  add_call: mockAddCall,
  is_auction_complete: mockIsAuctionComplete,
  get_contract: mockGetContract,
  calculate_score: mockCalculateScore,
  get_legal_plays: mockGetLegalPlays,
  get_trick_winner: mockGetTrickWinner,
}));

// Import after mock setup
const { WasmEngine, initWasm } = await import("../wasm-engine");

describe("initWasm", () => {
  it("calls the WASM init function", async () => {
    await initWasm();
    expect(mockInit).toHaveBeenCalled();
  });
});

describe("WasmEngine", () => {
  let engine: InstanceType<typeof WasmEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new WasmEngine();
  });

  it("generateDeal passes cleaned constraints and returns result", async () => {
    const mockDeal = { hands: {}, dealer: "N", vulnerability: "None" };
    mockGenerateDeal.mockReturnValue(mockDeal);

    const result = await engine.generateDeal({
      seats: [{ seat: Seat.South, minHcp: 12, customCheck: () => true }],
      rng: () => 0.5,
      seed: 42,
    });

    expect(result).toBe(mockDeal);
     
    const passedArg = mockGenerateDeal.mock.calls[0]?.[0];
    expect(passedArg?.constraints?.seed).toBe(42);
    expect(passedArg?.constraints?.seats[0]?.minHcp).toBe(12);
    expect("customCheck" in passedArg.constraints.seats[0]).toBe(false);
    expect("rng" in passedArg.constraints).toBe(false);
  });

  it("evaluateHand returns the WASM result unchanged", async () => {
    const mockEval = { hcp: 15, shape: [4, 3, 3, 3] };
    mockEvaluateHand.mockReturnValue(mockEval);

    const hand = { cards: [] };
    const result = await engine.evaluateHand(hand);
    expect(result).toBe(mockEval);
    expect(mockEvaluateHand).toHaveBeenCalledWith({ hand });
  });

  it("solveDeal rejects with DDS unavailable message", async () => {
    const stubDeal = {} as Deal;
    await expect(engine.solveDeal(stubDeal)).rejects.toThrow(
      "DDS not available",
    );
  });

  it("suggestPlay rejects with DDS unavailable message", async () => {
    await expect(
      engine.suggestPlay({ cards: [] }, [], null, []),
    ).rejects.toThrow("DDS not available in WASM build");
  });
});
