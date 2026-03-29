import { describe, it, expect } from "vitest";
import { Seat } from "../../engine/types";
import { resolveTransition } from "../phase-coordinator";
import type { PhaseEvent, TransitionDescriptor } from "../phase-coordinator";
import type { GamePhase } from "../phase-machine";
import { PlayPreference } from "../drill-types";

function expectNoTransition(desc: TransitionDescriptor): void {
  expect(desc.targetPhase).toBeNull();
  expect(desc.viewportsNeeded).toHaveLength(0);
  expect(desc.triggerDDS).toBe(false);
  expect(desc.captureInferences).toBe(false);
  expect(desc.serviceActions).toHaveLength(0);
  expect(desc.resetPlay).toBe(false);
  expect(desc.chainedEvent).toBeNull();
}

describe("AUCTION_COMPLETE", () => {
  it("servicePhase=EXPLANATION", () => {
    const desc = resolveTransition("BIDDING", { type: "AUCTION_COMPLETE", servicePhase: "EXPLANATION" });
    expect(desc.targetPhase).toBe("EXPLANATION");
    expect(desc.captureInferences).toBe(true);
    expect(desc.triggerDDS).toBe(true);
    expect(desc.viewportsNeeded).toEqual(["explanation"]);
    expect(desc.serviceActions).toHaveLength(0);
    expect(desc.resetPlay).toBe(false);
    expect(desc.chainedEvent).toBeNull();
  });

  it("servicePhase=DECLARER_PROMPT", () => {
    const desc = resolveTransition("BIDDING", { type: "AUCTION_COMPLETE", servicePhase: "DECLARER_PROMPT" });
    expect(desc.targetPhase).toBe("DECLARER_PROMPT");
    expect(desc.captureInferences).toBe(true);
    expect(desc.triggerDDS).toBe(false);
    expect(desc.viewportsNeeded).toEqual(["declarerPrompt"]);
    expect(desc.serviceActions).toHaveLength(0);
    expect(desc.resetPlay).toBe(false);
    expect(desc.chainedEvent).toBeNull();
  });

  it("servicePhase=PLAYING", () => {
    const desc = resolveTransition("BIDDING", { type: "AUCTION_COMPLETE", servicePhase: "PLAYING" });
    expect(desc.targetPhase).toBe("PLAYING");
    expect(desc.captureInferences).toBe(true);
    expect(desc.triggerDDS).toBe(false);
    expect(desc.viewportsNeeded).toEqual(["playing"]);
    expect(desc.serviceActions).toHaveLength(0);
    expect(desc.resetPlay).toBe(true);
    expect(desc.chainedEvent).toBeNull();
  });

  it("servicePhase=BIDDING → no transition", () => {
    const desc = resolveTransition("BIDDING", { type: "AUCTION_COMPLETE", servicePhase: "BIDDING" });
    expectNoTransition(desc);
  });
});

describe("PROMPT_ENTERED", () => {
  it("always → chains ACCEPT_PLAY", () => {
    const desc = resolveTransition("DECLARER_PROMPT", { type: "PROMPT_ENTERED", playPreference: PlayPreference.Always });
    expect(desc.targetPhase).toBeNull();
    expect(desc.chainedEvent).toEqual({ type: "ACCEPT_PLAY" });
  });

  it("skip → chains DECLINE_PLAY", () => {
    const desc = resolveTransition("DECLARER_PROMPT", { type: "PROMPT_ENTERED", playPreference: PlayPreference.Skip });
    expect(desc.targetPhase).toBeNull();
    expect(desc.chainedEvent).toEqual({ type: "DECLINE_PLAY" });
  });

  it("prompt → no transition", () => {
    const desc = resolveTransition("DECLARER_PROMPT", { type: "PROMPT_ENTERED", playPreference: PlayPreference.Prompt });
    expectNoTransition(desc);
  });
});

describe("ACCEPT_PLAY", () => {
  it("from DECLARER_PROMPT → PLAYING with service action", () => {
    const desc = resolveTransition("DECLARER_PROMPT", { type: "ACCEPT_PLAY", seat: Seat.South });
    expect(desc.targetPhase).toBe("PLAYING");
    expect(desc.serviceActions).toEqual([{ type: "acceptPrompt", mode: "play", seat: Seat.South }]);
    expect(desc.resetPlay).toBe(true);
    expect(desc.viewportsNeeded).toEqual(["playing"]);
    expect(desc.triggerDDS).toBe(false);
    expect(desc.chainedEvent).toBeNull();
  });

  it("seat override propagated", () => {
    const desc = resolveTransition("DECLARER_PROMPT", { type: "ACCEPT_PLAY", seat: Seat.North });
    expect(desc.serviceActions).toEqual([{ type: "acceptPrompt", mode: "play", seat: Seat.North }]);
  });

  it("from wrong phase → no transition", () => {
    const desc = resolveTransition("BIDDING", { type: "ACCEPT_PLAY", seat: Seat.South });
    expectNoTransition(desc);
  });
});

describe("DECLINE_PLAY", () => {
  it("from DECLARER_PROMPT → EXPLANATION with skip", () => {
    const desc = resolveTransition("DECLARER_PROMPT", { type: "DECLINE_PLAY" });
    expect(desc.targetPhase).toBe("EXPLANATION");
    expect(desc.serviceActions).toEqual([{ type: "acceptPrompt", mode: "skip" }]);
    expect(desc.triggerDDS).toBe(true);
    expect(desc.viewportsNeeded).toEqual(["explanation"]);
    expect(desc.resetPlay).toBe(false);
    expect(desc.chainedEvent).toBeNull();
  });

  it("from wrong phase → no transition", () => {
    const desc = resolveTransition("PLAYING", { type: "DECLINE_PLAY" });
    expectNoTransition(desc);
  });
});

describe("SKIP_TO_REVIEW", () => {
  it("from PLAYING → EXPLANATION", () => {
    const desc = resolveTransition("PLAYING", { type: "SKIP_TO_REVIEW" });
    expect(desc.targetPhase).toBe("EXPLANATION");
    expect(desc.serviceActions).toEqual([{ type: "skipToReview" }]);
    expect(desc.triggerDDS).toBe(true);
    expect(desc.viewportsNeeded).toEqual(["explanation"]);
    expect(desc.chainedEvent).toBeNull();
  });

  it("from wrong phase → no transition", () => {
    const desc = resolveTransition("EXPLANATION", { type: "SKIP_TO_REVIEW" });
    expectNoTransition(desc);
  });
});

describe("PLAY_COMPLETE", () => {
  it("from PLAYING → EXPLANATION", () => {
    const desc = resolveTransition("PLAYING", { type: "PLAY_COMPLETE" });
    expect(desc.targetPhase).toBe("EXPLANATION");
    expect(desc.triggerDDS).toBe(true);
    expect(desc.viewportsNeeded).toEqual(["explanation"]);
    expect(desc.serviceActions).toHaveLength(0);
    expect(desc.chainedEvent).toBeNull();
  });
});

describe("PLAY_THIS_HAND", () => {
  it("from EXPLANATION → PLAYING with two service actions", () => {
    const desc = resolveTransition("EXPLANATION", { type: "PLAY_THIS_HAND", seat: Seat.South });
    expect(desc.targetPhase).toBe("PLAYING");
    expect(desc.serviceActions).toEqual([
      { type: "acceptPrompt", mode: "replay" },
      { type: "acceptPrompt", mode: "play", seat: Seat.South },
    ]);
    expect(desc.resetPlay).toBe(true);
    expect(desc.viewportsNeeded).toEqual(["playing"]);
    expect(desc.triggerDDS).toBe(false);
    expect(desc.chainedEvent).toBeNull();
  });

  it("seat propagated to second action", () => {
    const desc = resolveTransition("EXPLANATION", { type: "PLAY_THIS_HAND", seat: Seat.North });
    expect(desc.serviceActions[1]).toEqual({ type: "acceptPrompt", mode: "play", seat: Seat.North });
  });

  it("from wrong phase → no transition", () => {
    const desc = resolveTransition("PLAYING", { type: "PLAY_THIS_HAND", seat: Seat.South });
    expectNoTransition(desc);
  });
});

describe("RESTART_PLAY", () => {
  it("from PLAYING → no phase change, acceptPrompt restart", () => {
    const desc = resolveTransition("PLAYING", { type: "RESTART_PLAY" });
    expect(desc.targetPhase).toBeNull();
    expect(desc.serviceActions).toEqual([{ type: "acceptPrompt", mode: "restart" }]);
    expect(desc.resetPlay).toBe(true);
    expect(desc.viewportsNeeded).toEqual(["playing"]);
    expect(desc.chainedEvent).toBeNull();
  });

  it("from wrong phase → no transition", () => {
    const desc = resolveTransition("EXPLANATION", { type: "RESTART_PLAY" });
    expectNoTransition(desc);
  });
});

describe("chained events", () => {
  it("AUCTION_COMPLETE → PROMPT_ENTERED(always) → ACCEPT_PLAY chain", () => {
    const auctionDesc = resolveTransition("BIDDING", { type: "AUCTION_COMPLETE", servicePhase: "DECLARER_PROMPT" });
    expect(auctionDesc.targetPhase).toBe("DECLARER_PROMPT");

    const promptDesc = resolveTransition("DECLARER_PROMPT", { type: "PROMPT_ENTERED", playPreference: PlayPreference.Always });
    expect(promptDesc.chainedEvent).toEqual({ type: "ACCEPT_PLAY" });

    const chainedDesc = resolveTransition("DECLARER_PROMPT", promptDesc.chainedEvent!);
    expect(chainedDesc.targetPhase).toBe("PLAYING");
    expect(chainedDesc.resetPlay).toBe(true);
  });

  it("PROMPT_ENTERED(skip) → DECLINE_PLAY chain", () => {
    const promptDesc = resolveTransition("DECLARER_PROMPT", { type: "PROMPT_ENTERED", playPreference: PlayPreference.Skip });
    const chainedDesc = resolveTransition("DECLARER_PROMPT", promptDesc.chainedEvent!);
    expect(chainedDesc.targetPhase).toBe("EXPLANATION");
    expect(chainedDesc.triggerDDS).toBe(true);
    expect(chainedDesc.serviceActions).toEqual([{ type: "acceptPrompt", mode: "skip" }]);
  });

  it("chain invariant: chained events never themselves chain", () => {
    const eventTypes: PhaseEvent["type"][] = [
      "AUCTION_COMPLETE", "ACCEPT_PLAY", "DECLINE_PLAY", "SKIP_TO_REVIEW",
      "PLAY_COMPLETE", "PLAY_THIS_HAND", "RESTART_PLAY",
    ];
    const phases: GamePhase[] = ["BIDDING", "DECLARER_PROMPT", "PLAYING", "EXPLANATION"];

    for (const eventType of eventTypes) {
      for (const phase of phases) {
        const event = createEvent(eventType);
        const desc = resolveTransition(phase, event);
        expect(desc.chainedEvent).toBeNull();
      }
    }

    for (const pref of [PlayPreference.Always, PlayPreference.Skip] as const) {
      const desc = resolveTransition("DECLARER_PROMPT", { type: "PROMPT_ENTERED", playPreference: pref });
      if (desc.chainedEvent) {
        const chainedDesc = resolveTransition("DECLARER_PROMPT", desc.chainedEvent);
        expect(chainedDesc.chainedEvent).toBeNull();
      }
    }
  });
});

function createEvent(type: PhaseEvent["type"]): PhaseEvent {
  switch (type) {
    case "AUCTION_COMPLETE": return { type, servicePhase: "EXPLANATION" };
    case "PROMPT_ENTERED": return { type, playPreference: PlayPreference.Prompt };
    case "ACCEPT_PLAY": return { type, seat: Seat.South };
    case "DECLINE_PLAY": return { type };
    case "SKIP_TO_REVIEW": return { type };
    case "PLAY_COMPLETE": return { type };
    case "PLAY_THIS_HAND": return { type, seat: Seat.South };
    case "RESTART_PLAY": return { type };
  }
}
