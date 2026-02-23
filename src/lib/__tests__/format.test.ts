import { describe, it, expect } from "vitest";
import { formatRuleName } from "../format";

describe("formatRuleName", () => {
  it("converts kebab-case to Title Case", () => {
    expect(formatRuleName("stayman-ask")).toBe("Stayman Ask");
  });

  it("converts multi-word kebab-case", () => {
    expect(formatRuleName("gerber-response-zero-four")).toBe(
      "Gerber Response Zero Four",
    );
  });

  it("handles single word", () => {
    expect(formatRuleName("pass")).toBe("Pass");
  });

  it("handles empty string", () => {
    expect(formatRuleName("")).toBe("");
  });

  it("uppercases bridge abbreviations", () => {
    expect(formatRuleName("sayc-open-1nt")).toBe("SAYC Open 1NT");
  });

  it("uppercases DONT", () => {
    expect(formatRuleName("dont-2h")).toBe("DONT 2h");
  });

  it("uppercases HCP", () => {
    expect(formatRuleName("hcp-check")).toBe("HCP Check");
  });
});
