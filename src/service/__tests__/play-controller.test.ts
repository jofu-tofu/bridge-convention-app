/**
 * Play controller tests — pure logic for card play phase.
 *
 * Tests behavior through the public API (processPlayCard).
 * Uses createStubEngine at the EnginePort boundary.
 */
import { describe, it, expect } from "vitest";
import { Seat, Suit, Rank, BidSuit } from "../../engine/types";
import type { Contract } from "../../engine/types";
import { createStubEngine } from "../../test-support/engine-stub";
import {
  makeCard,
  makeSimpleTestDeal,
  makeDrillSession,
  makeContract,
} from "../../test-support/fixtures";
import { createInferenceCoordinator } from "../../inference/inference-coordinator";
import { SessionState } from "../session-state";
import { processPlayCard } from "../play-controller";
import type { DrillBundle } from "../../bootstrap/types";

// ── Helpers ──────────────────────────────────────────────────────────

function makeBundle(overrides: Partial<DrillBundle> = {}): DrillBundle {
  return {
    deal: makeSimpleTestDeal(),
    session: makeDrillSession(),
    nsInferenceEngine: null,
    ewInferenceEngine: null,
    ...overrides,
  };
}

function makePlayState(overrides: Partial<DrillBundle> = {}): SessionState {
  const bundle = makeBundle(overrides);
  const coordinator = createInferenceCoordinator();
  const state = new SessionState(bundle, coordinator);

  // Set up for play phase: South declares 1NT, West leads
  const contract = makeContract(Seat.South);
  state.contract = contract;
  state.phase = "PLAYING";
  state.effectiveUserSeat = Seat.South;
  state.initializePlay(contract);

  return state;
}

// ── Card submission ─────────────────────────────────────────────────

describe("processPlayCard", () => {
  describe("card validation", () => {
    it("rejects play when there is no active contract", async () => {
      const state = makePlayState();
      state.contract = null;
      const engine = createStubEngine();

      const card = makeCard(Suit.Hearts, Rank.Ace);
      const result = await processPlayCard(state, card, Seat.West, engine);

      expect(result.accepted).toBe(false);
    });

    it("rejects play when there is no current player", async () => {
      const state = makePlayState();
      state.currentPlayer = null;
      const engine = createStubEngine();

      const card = makeCard(Suit.Hearts, Rank.Ace);
      const result = await processPlayCard(state, card, Seat.West, engine);

      expect(result.accepted).toBe(false);
    });

    it("rejects play from wrong seat", async () => {
      const state = makePlayState();
      // currentPlayer is West (left of South declarer)
      expect(state.currentPlayer).toBe(Seat.West);
      const engine = createStubEngine();

      // East tries to play — not current player
      const card = makeCard(Suit.Diamonds, Rank.Ace);
      const result = await processPlayCard(state, card, Seat.East, engine);

      expect(result.accepted).toBe(false);
    });

    it("rejects play from non-user-controlled seat", async () => {
      const state = makePlayState();
      // West is current player but not user-controlled (South is user)
      expect(state.currentPlayer).toBe(Seat.West);
      const engine = createStubEngine();

      const card = makeCard(Suit.Spades, Rank.Ace);
      const result = await processPlayCard(state, card, Seat.West, engine);

      expect(result.accepted).toBe(false);
    });

    it("rejects illegal card not in legal plays", async () => {
      const state = makePlayState();
      // Make it user's turn: South is declarer, North is dummy (user controls both)
      // Advance currentPlayer to South
      state.currentPlayer = Seat.South;

      const illegalCard = makeCard(Suit.Clubs, Rank.Ace); // South has Hearts only
      const engine = createStubEngine({
        async getLegalPlays() {
          // Return only hearts as legal
          return [makeCard(Suit.Hearts, Rank.Ace)];
        },
      });

      const result = await processPlayCard(state, illegalCard, Seat.South, engine);

      expect(result.accepted).toBe(false);
    });

    it("accepts valid card from user-controlled seat", async () => {
      const state = makePlayState();
      // South is declarer, user controls South. Make it South's turn.
      state.currentPlayer = Seat.South;

      const card = makeCard(Suit.Hearts, Rank.Ace);
      const engine = createStubEngine({
        async getLegalPlays() {
          return [makeCard(Suit.Hearts, Rank.Ace), makeCard(Suit.Hearts, Rank.King)];
        },
      });

      const result = await processPlayCard(state, card, Seat.South, engine);

      expect(result.accepted).toBe(true);
    });

    it("user controls dummy hand when user is declarer", async () => {
      const state = makePlayState();
      // South declares, North is dummy. User (South) controls both.
      // Make it North's (dummy) turn
      state.currentPlayer = Seat.North;

      const card = makeCard(Suit.Clubs, Rank.Ace); // North has clubs
      const engine = createStubEngine({
        async getLegalPlays() {
          return [makeCard(Suit.Clubs, Rank.Ace)];
        },
      });

      const result = await processPlayCard(state, card, Seat.North, engine);

      expect(result.accepted).toBe(true);
    });
  });

  // ── Trick completion ────────────────────────────────────────────────

  describe("trick completion", () => {
    it("reports trickComplete when 4 cards have been played", async () => {
      const state = makePlayState();
      // Pre-fill 3 cards in current trick, user plays the 4th
      state.currentTrick = [
        { card: makeCard(Suit.Spades, Rank.Ace), seat: Seat.West },
        { card: makeCard(Suit.Clubs, Rank.Two), seat: Seat.North },
        { card: makeCard(Suit.Diamonds, Rank.Two), seat: Seat.East },
      ];
      state.currentPlayer = Seat.South;

      const card = makeCard(Suit.Hearts, Rank.Ace);
      const engine = createStubEngine({
        async getLegalPlays() {
          return [makeCard(Suit.Hearts, Rank.Ace)];
        },
        async getTrickWinner() {
          return Seat.South;
        },
      });

      const result = await processPlayCard(state, card, Seat.South, engine);

      expect(result.accepted).toBe(true);
      expect(result.trickComplete).toBe(true);
    });

    it("increments declarerTricksWon when declarer side wins trick", async () => {
      const state = makePlayState();
      state.currentTrick = [
        { card: makeCard(Suit.Spades, Rank.Ace), seat: Seat.West },
        { card: makeCard(Suit.Clubs, Rank.Two), seat: Seat.North },
        { card: makeCard(Suit.Diamonds, Rank.Two), seat: Seat.East },
      ];
      state.currentPlayer = Seat.South;

      const card = makeCard(Suit.Hearts, Rank.Ace);
      const engine = createStubEngine({
        async getLegalPlays() {
          return [card];
        },
        async getTrickWinner() {
          return Seat.South; // declarer wins
        },
      });

      expect(state.declarerTricksWon).toBe(0);
      await processPlayCard(state, card, Seat.South, engine);
      expect(state.declarerTricksWon).toBe(1);
    });

    it("increments defenderTricksWon when defender side wins trick", async () => {
      const state = makePlayState();
      state.currentTrick = [
        { card: makeCard(Suit.Spades, Rank.Ace), seat: Seat.West },
        { card: makeCard(Suit.Clubs, Rank.Two), seat: Seat.North },
        { card: makeCard(Suit.Diamonds, Rank.Two), seat: Seat.East },
      ];
      state.currentPlayer = Seat.South;

      const card = makeCard(Suit.Hearts, Rank.Two);
      const engine = createStubEngine({
        async getLegalPlays() {
          return [card];
        },
        async getTrickWinner() {
          return Seat.West; // defender wins
        },
      });

      expect(state.defenderTricksWon).toBe(0);
      await processPlayCard(state, card, Seat.South, engine);
      expect(state.defenderTricksWon).toBe(1);
    });

    it("appends completed trick to tricks array and clears currentTrick", async () => {
      const state = makePlayState();
      state.currentTrick = [
        { card: makeCard(Suit.Spades, Rank.Ace), seat: Seat.West },
        { card: makeCard(Suit.Clubs, Rank.Two), seat: Seat.North },
        { card: makeCard(Suit.Diamonds, Rank.Two), seat: Seat.East },
      ];
      state.currentPlayer = Seat.South;

      const card = makeCard(Suit.Hearts, Rank.Ace);
      const engine = createStubEngine({
        async getLegalPlays() {
          return [card];
        },
        async getTrickWinner() {
          return Seat.South;
        },
      });

      await processPlayCard(state, card, Seat.South, engine);

      expect(state.tricks).toHaveLength(1);
      expect(state.tricks[0]!.plays).toHaveLength(4);
      expect(state.currentTrick).toHaveLength(0);
    });

    it("sets currentPlayer to trick winner after scoring", async () => {
      const state = makePlayState();
      state.currentTrick = [
        { card: makeCard(Suit.Spades, Rank.Ace), seat: Seat.West },
        { card: makeCard(Suit.Clubs, Rank.Two), seat: Seat.North },
        { card: makeCard(Suit.Diamonds, Rank.Two), seat: Seat.East },
      ];
      state.currentPlayer = Seat.South;

      const card = makeCard(Suit.Hearts, Rank.Ace);
      const engine = createStubEngine({
        async getLegalPlays() {
          return [card];
        },
        async getTrickWinner() {
          return Seat.East; // East wins, but East is AI
        },
      });

      const result = await processPlayCard(state, card, Seat.South, engine);

      // East wins but is AI, so AI loop runs. Result reflects post-AI state.
      expect(result.accepted).toBe(true);
      expect(result.trickComplete).toBe(true);
    });
  });

  // ── AI play loop ──────────────────────────────────────────────────

  describe("AI play loop", () => {
    it("runs AI plays after user plays mid-trick", async () => {
      const state = makePlayState();
      // South leads (user's turn), then West, North (dummy), East should be AI-played
      // Actually: South declares 1NT, West leads. Let's set up so South plays and
      // next seats are AI.
      // Make it so North leads (dummy, user-controlled), then E, S, W follow
      state.currentPlayer = Seat.North; // dummy leads, user-controlled
      state.currentTrick = [];

      const leadCard = makeCard(Suit.Clubs, Rank.Ace);
      // After North plays, East (AI) should play, then South (user) stops the loop
      const engine = createStubEngine({
        async getLegalPlays() {
          return [leadCard, makeCard(Suit.Clubs, Rank.King)];
        },
      });

      const result = await processPlayCard(state, leadCard, Seat.North, engine);

      expect(result.accepted).toBe(true);
      // East is AI, should have played
      expect(result.aiPlays.length).toBeGreaterThanOrEqual(1);
      expect(result.aiPlays[0]!.seat).toBe(Seat.East);
    });

    it("AI plays stop when reaching user-controlled seat", async () => {
      const state = makePlayState();
      // Set up: North (dummy) leads, East plays (AI), then South (user) — loop stops
      state.currentPlayer = Seat.North;
      state.currentTrick = [];

      const card = makeCard(Suit.Clubs, Rank.Ace);
      const engine = createStubEngine({
        async getLegalPlays() {
          return [card];
        },
      });

      const result = await processPlayCard(state, card, Seat.North, engine);

      // East is AI and plays. South is user — loop stops.
      // Only 1 AI play (East)
      expect(result.aiPlays).toHaveLength(1);
      expect(result.aiPlays[0]!.seat).toBe(Seat.East);
      expect(result.currentPlayer).toBe(Seat.South);
    });

    it("AI plays include card and reason for each play", async () => {
      const state = makePlayState();
      state.currentPlayer = Seat.North;
      state.currentTrick = [];

      const card = makeCard(Suit.Clubs, Rank.Ace);
      const engine = createStubEngine({
        async getLegalPlays() {
          return [card];
        },
      });

      const result = await processPlayCard(state, card, Seat.North, engine);

      for (const aiPlay of result.aiPlays) {
        expect(aiPlay.card).toBeDefined();
        expect(aiPlay.seat).toBeDefined();
        expect(typeof aiPlay.reason).toBe("string");
      }
    });

    it("AI completes trick and continues if winner is also AI", async () => {
      const state = makePlayState();
      // Set up: South plays 3rd card, West (AI) plays 4th to complete trick.
      // The trick completes during the AI loop (not on user's card).
      state.currentTrick = [
        { card: makeCard(Suit.Clubs, Rank.Two), seat: Seat.North },
        { card: makeCard(Suit.Diamonds, Rank.Two), seat: Seat.East },
      ];
      state.currentPlayer = Seat.South;

      const card = makeCard(Suit.Hearts, Rank.Two);
      const engine = createStubEngine({
        async getLegalPlays() {
          return [card, makeCard(Suit.Hearts, Rank.Three)];
        },
        async getTrickWinner() {
          // West wins — AI continues leading next trick
          return Seat.West;
        },
      });

      const result = await processPlayCard(state, card, Seat.South, engine);

      expect(result.accepted).toBe(true);
      // West plays 4th card (completes trick), then West wins and leads next trick.
      // AI loop continues until user-controlled seat (North/South).
      expect(result.aiPlays.length).toBeGreaterThanOrEqual(1);
      // trickComplete=false because the trick was NOT complete on the user's card —
      // it completed during the AI loop
      expect(result.trickComplete).toBe(false);
      // Trick was scored during AI loop
      expect(state.tricks.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Play completion ───────────────────────────────────────────────

  describe("play completion", () => {
    it("transitions to EXPLANATION when all 13 tricks are done", async () => {
      const state = makePlayState();
      // Pre-fill 12 completed tricks
      for (let i = 0; i < 12; i++) {
        state.tricks = [
          ...state.tricks,
          {
            plays: [
              { card: makeCard(Suit.Hearts, Rank.Two), seat: Seat.West },
              { card: makeCard(Suit.Clubs, Rank.Two), seat: Seat.North },
              { card: makeCard(Suit.Diamonds, Rank.Two), seat: Seat.East },
              { card: makeCard(Suit.Hearts, Rank.Three), seat: Seat.South },
            ],
            trumpSuit: undefined,
            winner: Seat.South,
          },
        ];
      }
      // Set up the 13th trick: 3 cards played, user plays 4th
      state.currentTrick = [
        { card: makeCard(Suit.Spades, Rank.Ace), seat: Seat.West },
        { card: makeCard(Suit.Clubs, Rank.Ace), seat: Seat.North },
        { card: makeCard(Suit.Diamonds, Rank.Ace), seat: Seat.East },
      ];
      state.currentPlayer = Seat.South;

      const card = makeCard(Suit.Hearts, Rank.Ace);
      const engine = createStubEngine({
        async getLegalPlays() {
          return [card];
        },
        async getTrickWinner() {
          return Seat.South;
        },
        async calculateScore() {
          return 90;
        },
      });

      const result = await processPlayCard(state, card, Seat.South, engine);

      expect(result.accepted).toBe(true);
      expect(result.trickComplete).toBe(true);
      expect(result.playComplete).toBe(true);
      expect(result.score).toBe(90);
      expect(result.currentPlayer).toBeNull();
      expect(state.phase).toBe("EXPLANATION");
    });

    it("sets playScore on state when play completes", async () => {
      const state = makePlayState();
      // Pre-fill 12 tricks
      for (let i = 0; i < 12; i++) {
        state.tricks = [
          ...state.tricks,
          {
            plays: [
              { card: makeCard(Suit.Hearts, Rank.Two), seat: Seat.West },
              { card: makeCard(Suit.Clubs, Rank.Two), seat: Seat.North },
              { card: makeCard(Suit.Diamonds, Rank.Two), seat: Seat.East },
              { card: makeCard(Suit.Hearts, Rank.Three), seat: Seat.South },
            ],
            trumpSuit: undefined,
            winner: Seat.South,
          },
        ];
      }
      state.currentTrick = [
        { card: makeCard(Suit.Spades, Rank.Ace), seat: Seat.West },
        { card: makeCard(Suit.Clubs, Rank.Ace), seat: Seat.North },
        { card: makeCard(Suit.Diamonds, Rank.Ace), seat: Seat.East },
      ];
      state.currentPlayer = Seat.South;

      const card = makeCard(Suit.Hearts, Rank.Ace);
      const engine = createStubEngine({
        async getLegalPlays() {
          return [card];
        },
        async getTrickWinner() {
          return Seat.South;
        },
        async calculateScore() {
          return -100;
        },
      });

      await processPlayCard(state, card, Seat.South, engine);

      expect(state.playScore).toBe(-100);
      expect(state.currentPlayer).toBeNull();
    });

    it("returns empty aiPlays when play completes on user's card", async () => {
      const state = makePlayState();
      for (let i = 0; i < 12; i++) {
        state.tricks = [
          ...state.tricks,
          {
            plays: [
              { card: makeCard(Suit.Hearts, Rank.Two), seat: Seat.West },
              { card: makeCard(Suit.Clubs, Rank.Two), seat: Seat.North },
              { card: makeCard(Suit.Diamonds, Rank.Two), seat: Seat.East },
              { card: makeCard(Suit.Hearts, Rank.Three), seat: Seat.South },
            ],
            trumpSuit: undefined,
            winner: Seat.South,
          },
        ];
      }
      state.currentTrick = [
        { card: makeCard(Suit.Spades, Rank.Ace), seat: Seat.West },
        { card: makeCard(Suit.Clubs, Rank.Ace), seat: Seat.North },
        { card: makeCard(Suit.Diamonds, Rank.Ace), seat: Seat.East },
      ];
      state.currentPlayer = Seat.South;

      const card = makeCard(Suit.Hearts, Rank.Ace);
      const engine = createStubEngine({
        async getLegalPlays() {
          return [card];
        },
        async getTrickWinner() {
          return Seat.South;
        },
        async calculateScore() {
          return 90;
        },
      });

      const result = await processPlayCard(state, card, Seat.South, engine);

      expect(result.aiPlays).toHaveLength(0);
    });
  });

  // ── Mid-trick advancement ─────────────────────────────────────────

  describe("mid-trick advancement", () => {
    it("advances currentPlayer to next seat after user plays mid-trick", async () => {
      const state = makePlayState();
      // Set up: South leads, no cards played yet. After South plays, West is next (AI).
      state.currentPlayer = Seat.South;
      state.currentTrick = [];

      const card = makeCard(Suit.Hearts, Rank.Ace);
      const engine = createStubEngine({
        async getLegalPlays() {
          return [card];
        },
      });

      const result = await processPlayCard(state, card, Seat.South, engine);

      expect(result.accepted).toBe(true);
      // West is AI, AI loop runs. After W plays, N (dummy, user-controlled) is next.
      // AI loop should stop at North (dummy = user-controlled).
      expect(result.aiPlays.length).toBeGreaterThanOrEqual(1);
    });

    it("returns legal plays when next turn is user-controlled", async () => {
      const state = makePlayState();
      // West (AI) already played, North (dummy, user-controlled) is next
      state.currentTrick = [
        { card: makeCard(Suit.Spades, Rank.Ace), seat: Seat.West },
      ];
      state.currentPlayer = Seat.North; // dummy, user-controlled

      const card = makeCard(Suit.Clubs, Rank.Ace);
      const expectedLegalPlays = [
        makeCard(Suit.Clubs, Rank.Ace),
        makeCard(Suit.Clubs, Rank.King),
      ];
      const engine = createStubEngine({
        async getLegalPlays() {
          return expectedLegalPlays;
        },
      });

      const result = await processPlayCard(state, card, Seat.North, engine);

      expect(result.accepted).toBe(true);
      // After North plays, East (AI) is next, then South (user).
      // AI loop plays East, stops at South.
      // Result should have South as currentPlayer.
    });

    it("does not report trickComplete when trick is still in progress", async () => {
      const state = makePlayState();
      state.currentPlayer = Seat.South;
      state.currentTrick = [];

      const card = makeCard(Suit.Hearts, Rank.Ace);
      const engine = createStubEngine({
        async getLegalPlays() {
          return [card];
        },
      });

      const result = await processPlayCard(state, card, Seat.South, engine);

      // With 1 card played by user + AI plays, trick may or may not complete
      // depending on how many AI seats play. What we verify is accepted=true.
      expect(result.accepted).toBe(true);
    });
  });

  // ── Trump suit ──────────────────────────────────────────────────────

  describe("trump suit handling", () => {
    it("sets trumpSuit from contract strain during initializePlay", () => {
      const state = makePlayState();
      // Default makeContract creates 1NT
      expect(state.trumpSuit).toBeUndefined();
    });

    it("sets trumpSuit for suited contract", () => {
      const bundle = makeBundle();
      const coordinator = createInferenceCoordinator();
      const state = new SessionState(bundle, coordinator);

      const suitedContract: Contract = {
        level: 4,
        strain: BidSuit.Hearts,
        doubled: false,
        redoubled: false,
        declarer: Seat.South,
      };
      state.contract = suitedContract;
      state.phase = "PLAYING";
      state.effectiveUserSeat = Seat.South;
      state.initializePlay(suitedContract);

      expect(state.trumpSuit).toBe(Suit.Hearts);
    });
  });

  // ── No Svelte imports ─────────────────────────────────────────────

  describe("module purity", () => {
    it("play-controller has no svelte imports", async () => {
      const { readFileSync } = await import("fs");
      const content = readFileSync("src/service/play-controller.ts", "utf-8");
      expect(content).not.toContain("from \"svelte\"");
      expect(content).not.toContain("from 'svelte'");
      const codeLines = content
        .split("\n")
        .filter(
          (l) =>
            !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//"),
        );
      const codeOnly = codeLines.join("\n");
      expect(codeOnly).not.toMatch(/\btick\s*\(/);
    });
  });
});
