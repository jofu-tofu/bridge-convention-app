import { describe, it, expect } from "vitest";
import { advanceLocalFsm } from "../local-fsm";
import type { PhaseTransition } from "../../rule-module";
import type { CommittedStep } from "../../../../core/contracts/committed-step";
import { INITIAL_NEGOTIATION } from "../../../../core/contracts/committed-step";
import { Seat } from "../../../../engine/types";

type Phase = "idle" | "asked" | "shown" | "denied";

const transitions: readonly PhaseTransition<Phase>[] = [
  {
    from: "idle",
    to: "asked",
    on: { act: "inquire", feature: "majorSuit" },
  },
  {
    from: "asked",
    to: "shown",
    on: { act: "show", feature: "heldSuit" },
  },
  {
    from: "asked",
    to: "denied",
    on: { act: "deny", feature: "majorSuit" },
  },
];

function makeStep(
  obs: CommittedStep["publicActions"],
): CommittedStep {
  return {
    actor: Seat.South,
    call: { type: "pass" },
    resolvedClaim: null,
    publicActions: obs,
    negotiationDelta: {},
    stateAfter: INITIAL_NEGOTIATION,
    status: "resolved",
  };
}

describe("advanceLocalFsm", () => {
  it("transitions on matching observation", () => {
    const step = makeStep([{ act: "inquire", feature: "majorSuit" }]);
    expect(advanceLocalFsm("idle", step, transitions)).toBe("asked");
  });

  it("stays in current phase when no match", () => {
    const step = makeStep([{ act: "pass" }]);
    expect(advanceLocalFsm("idle", step, transitions)).toBe("idle");
  });

  it("first matching transition wins", () => {
    // Both show and deny could match from "asked" — show is first
    const step = makeStep([
      { act: "show", feature: "heldSuit", suit: "hearts" },
    ]);
    expect(advanceLocalFsm("asked", step, transitions)).toBe("shown");
  });

  it("transitions with multi-from phases", () => {
    const multiTransitions: readonly PhaseTransition<"a" | "b" | "c">[] = [
      {
        from: ["a", "b"],
        to: "c",
        on: { act: "pass" },
      },
    ];
    const step = makeStep([{ act: "pass" }]);
    expect(advanceLocalFsm("a", step, multiTransitions)).toBe("c");
    expect(advanceLocalFsm("b", step, multiTransitions)).toBe("c");
  });

  it("does not transition when from phase doesn't match", () => {
    const step = makeStep([{ act: "deny", feature: "majorSuit" }]);
    // "denied" phase has no transitions in the list
    expect(advanceLocalFsm("denied", step, transitions)).toBe("denied");
  });

  it("matches ANY observation in the step's publicActions", () => {
    // Step has multiple observations; transition should fire if any matches
    const step = makeStep([
      { act: "show", feature: "shortMajor", suit: "hearts" },
      { act: "force", level: "game" },
    ]);
    const smolTransitions: readonly PhaseTransition<"idle" | "placing">[] = [
      {
        from: "idle",
        to: "placing",
        on: { act: "show", feature: "shortMajor" },
      },
    ];
    expect(advanceLocalFsm("idle", step, smolTransitions)).toBe("placing");
  });
});
