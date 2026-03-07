import { describe, expect, test } from "vitest";
import { ForcingState } from "..";

describe("contracts barrel", () => {
  test("re-exports runtime enums", () => {
    expect(ForcingState.GameForcing).toBe("game-forcing");
  });
});
