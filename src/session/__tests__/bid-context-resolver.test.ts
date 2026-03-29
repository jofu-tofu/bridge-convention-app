import { describe, it, expect } from "vitest";
import { resolveBidContext } from "../bid-context-resolver";
import type { PracticeFocus } from "../drill-types";
import { PracticeMode } from "../drill-types";

describe("resolveBidContext", () => {
  const focus: PracticeFocus = {
    targetModuleIds: ["stayman"],
    prerequisiteModuleIds: ["natural-bids"],
    followUpModuleIds: ["smolen"],
    backgroundModuleIds: ["blackwood"],
  };

  it("returns 'target' for decision-drill regardless of module", () => {
    expect(resolveBidContext("natural-bids", focus, PracticeMode.DecisionDrill)).toBe(
      "target",
    );
    expect(resolveBidContext("stayman", focus, PracticeMode.DecisionDrill)).toBe(
      "target",
    );
    expect(resolveBidContext(undefined, focus, PracticeMode.DecisionDrill)).toBe(
      "target",
    );
  });

  it("returns 'target' for target module in full-auction", () => {
    expect(resolveBidContext("stayman", focus, PracticeMode.FullAuction)).toBe("target");
  });

  it("returns 'prerequisite' for prerequisite module in full-auction", () => {
    expect(resolveBidContext("natural-bids", focus, PracticeMode.FullAuction)).toBe(
      "prerequisite",
    );
  });

  it("returns 'follow-up' for follow-up module in full-auction", () => {
    expect(resolveBidContext("smolen", focus, PracticeMode.FullAuction)).toBe("follow-up");
  });

  it("returns 'background' for background module in full-auction", () => {
    expect(resolveBidContext("blackwood", focus, PracticeMode.FullAuction)).toBe(
      "background",
    );
  });

  it("returns 'off-convention' for unmatched module", () => {
    expect(resolveBidContext("unknown-module", focus, PracticeMode.FullAuction)).toBe(
      "off-convention",
    );
  });

  it("returns 'off-convention' for undefined matchedModuleId in non-decision mode", () => {
    expect(resolveBidContext(undefined, focus, PracticeMode.FullAuction)).toBe(
      "off-convention",
    );
  });

  it("works with continuation-drill mode", () => {
    expect(resolveBidContext("stayman", focus, PracticeMode.ContinuationDrill)).toBe(
      "target",
    );
    expect(resolveBidContext("natural-bids", focus, PracticeMode.ContinuationDrill)).toBe(
      "prerequisite",
    );
  });
});
