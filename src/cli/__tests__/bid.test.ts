import { describe, it, expect, beforeEach } from "vitest";
import { bidCommand } from "../commands/bid";
import { createCliDependencies } from "../engine-factory";
import { BidSuit } from "../../engine/types";
import type { ContractBid } from "../../engine/types";
import { clearRegistry, registerConvention } from "../../conventions/registry";
import { staymanConfig } from "../../conventions/stayman";

const deps = createCliDependencies();

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
});

describe("bid command", () => {
  it("returns bid with convention for valid hand", async () => {
    // 13 HCP, 4 hearts — should trigger Stayman 2C
    const handStr = "SK S5 S2 HA HK HQ H3 D5 D3 D2 C5 C3 C2";
    const result = await bidCommand.handler(
      { hand: handStr, seat: "S", convention: "stayman" },
      deps,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.type).toBe("bid");
    const data = result.value.data as { call: ContractBid; rule: string; explanation: string };
    expect(data.call.type).toBe("bid");
    expect(data.call.level).toBe(2);
    expect(data.call.strain).toBe(BidSuit.Clubs);
    expect(data.rule).toBe("stayman-ask");
    expect(data.explanation).toBeDefined();
  });

  it("returns error without convention", async () => {
    const handStr = "SK S5 S2 HA HK HQ H3 D5 D3 D2 C5 C3 C2";
    const result = await bidCommand.handler({ hand: handStr, seat: "S" }, deps);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_ARGS");
  });

  it("returns error without hand", async () => {
    const result = await bidCommand.handler({ seat: "S", convention: "stayman" }, deps);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_ARGS");
  });

  it("returns error with invalid seat", async () => {
    const handStr = "SK S5 S2 HA HK HQ H3 D5 D3 D2 C5 C3 C2";
    const result = await bidCommand.handler({ hand: handStr, seat: "X", convention: "stayman" }, deps);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_ARGS");
  });

  it("returns pass when no rules match", async () => {
    // 13 HCP but no 4-card major — no Stayman rule matches
    const handStr = "SA S5 S2 HK H8 H3 DA DQ D7 D4 C5 C3 C2";
    const result = await bidCommand.handler(
      { hand: handStr, seat: "S", convention: "stayman" },
      deps,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.type).toBe("bid");
    const data = result.value.data as { call: { type: string } };
    expect(data.call.type).toBe("pass");
  });
});
