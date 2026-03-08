import { describe, expect, test } from "vitest";
import { ConventionCategory, registerConvention, hcpMin } from "..";

describe("conventions/core barrel", () => {
  test("re-exports runtime enums", () => {
    expect(ConventionCategory.Asking).toBe("Asking");
  });
  test("re-exports registry functions", () => {
    expect(typeof registerConvention).toBe("function");
  });
  test("re-exports condition builders", () => {
    expect(typeof hcpMin).toBe("function");
  });
});
