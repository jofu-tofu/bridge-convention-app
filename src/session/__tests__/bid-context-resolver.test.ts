import { describe, it, expect } from "vitest";
import { resolveBidContext } from "../bid-context-resolver";
import type { PracticeFocus } from "../drill-types";

describe("resolveBidContext", () => {
  const focus: PracticeFocus = {
    targetModuleIds: ["stayman"],
    prerequisiteModuleIds: ["natural-bids"],
    followUpModuleIds: ["smolen"],
    backgroundModuleIds: ["blackwood"],
  };

  it("returns 'target' for decision-drill regardless of module", () => {
    expect(resolveBidContext("natural-bids", focus, "decision-drill")).toBe(
      "target",
    );
    expect(resolveBidContext("stayman", focus, "decision-drill")).toBe(
      "target",
    );
    expect(resolveBidContext(undefined, focus, "decision-drill")).toBe(
      "target",
    );
  });

  it("returns 'target' for target module in full-auction", () => {
    expect(resolveBidContext("stayman", focus, "full-auction")).toBe("target");
  });

  it("returns 'prerequisite' for prerequisite module in full-auction", () => {
    expect(resolveBidContext("natural-bids", focus, "full-auction")).toBe(
      "prerequisite",
    );
  });

  it("returns 'follow-up' for follow-up module in full-auction", () => {
    expect(resolveBidContext("smolen", focus, "full-auction")).toBe("follow-up");
  });

  it("returns 'background' for background module in full-auction", () => {
    expect(resolveBidContext("blackwood", focus, "full-auction")).toBe(
      "background",
    );
  });

  it("returns 'off-convention' for unmatched module", () => {
    expect(resolveBidContext("unknown-module", focus, "full-auction")).toBe(
      "off-convention",
    );
  });

  it("returns 'off-convention' for undefined matchedModuleId in non-decision mode", () => {
    expect(resolveBidContext(undefined, focus, "full-auction")).toBe(
      "off-convention",
    );
  });

  it("works with continuation-drill mode", () => {
    expect(resolveBidContext("stayman", focus, "continuation-drill")).toBe(
      "target",
    );
    expect(resolveBidContext("natural-bids", focus, "continuation-drill")).toBe(
      "prerequisite",
    );
  });
});
