import { describe, it, expect } from "vitest";
import { scoreCommand } from "../commands/score";
import { createCliDependencies } from "../engine-factory";

const deps = createCliDependencies();

describe("score command", () => {
  it("calculates basic 3NT making score", async () => {
    const result = await scoreCommand.handler(
      { contract: "3NT", tricks: "9" },
      deps,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.type).toBe("score");
    const data = result.value.data as { score: number; contract: string };
    expect(data.score).toBe(400); // 3NT making = 100 trick points + 300 game bonus
    expect(data.contract).toBe("3NT");
  });

  it("calculates doubled contract score", async () => {
    const result = await scoreCommand.handler(
      { contract: "4SX", tricks: "10" },
      deps,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.type).toBe("score");
    const data = result.value.data as { score: number };
    // 4S doubled making: 120*2=240 trick pts + 300 game bonus + 50 insult = 590
    expect(data.score).toBe(590);
  });

  it("calculates vulnerable score", async () => {
    const result = await scoreCommand.handler(
      { contract: "3NT", tricks: "9", vulnerable: true },
      deps,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.type).toBe("score");
    const data = result.value.data as { score: number; vulnerable: boolean };
    expect(data.score).toBe(600); // 100 trick pts + 500 vul game bonus
    expect(data.vulnerable).toBe(true);
  });

  it("calculates going down score (negative)", async () => {
    const result = await scoreCommand.handler(
      { contract: "3NT", tricks: "7" },
      deps,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.type).toBe("score");
    const data = result.value.data as { score: number };
    // Down 2, not vulnerable, undoubled: -100
    expect(data.score).toBe(-100);
  });

  it("returns error on invalid contract string", async () => {
    const result = await scoreCommand.handler({ contract: "8NT", tricks: "9" }, deps);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_ARGS");
  });

  it("returns error when missing contract", async () => {
    const result = await scoreCommand.handler({ tricks: "9" }, deps);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_ARGS");
  });

  it("returns error when missing tricks", async () => {
    const result = await scoreCommand.handler({ contract: "3NT" }, deps);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_ARGS");
  });

  it("handles redoubled contract", async () => {
    const result = await scoreCommand.handler(
      { contract: "4SXX", tricks: "10" },
      deps,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.type).toBe("score");
    const data = result.value.data as { score: number };
    // 4S redoubled making: 120*4=480 trick pts + 300 game bonus + 100 insult = 880
    expect(data.score).toBe(880);
  });
});
