import { describe, it, expect } from "vitest";
import { derivePracticeFocus } from "../practice-focus";

describe("derivePracticeFocus", () => {
  const memberIds = ["natural-bids", "stayman", "jacoby-transfers", "smolen"];

  it("returns all modules as targets when no targetModuleId", () => {
    const focus = derivePracticeFocus(memberIds);
    expect(focus.targetModuleIds).toEqual(memberIds);
    expect(focus.prerequisiteModuleIds).toEqual([]);
    expect(focus.followUpModuleIds).toEqual([]);
    expect(focus.backgroundModuleIds).toEqual([]);
  });

  it("splits modules around the target", () => {
    const focus = derivePracticeFocus(memberIds, "stayman");
    expect(focus.prerequisiteModuleIds).toEqual(["natural-bids"]);
    expect(focus.targetModuleIds).toEqual(["stayman"]);
    expect(focus.followUpModuleIds).toEqual(["jacoby-transfers", "smolen"]);
  });

  it("falls back to all-targets for unknown targetModuleId", () => {
    const focus = derivePracticeFocus(memberIds, "nonexistent");
    expect(focus.targetModuleIds).toEqual(memberIds);
    expect(focus.prerequisiteModuleIds).toEqual([]);
    expect(focus.followUpModuleIds).toEqual([]);
  });

  it("handles empty memberIds", () => {
    const focus = derivePracticeFocus([]);
    expect(focus.targetModuleIds).toEqual([]);
    expect(focus.prerequisiteModuleIds).toEqual([]);
    expect(focus.followUpModuleIds).toEqual([]);
  });

  it("has no prerequisites when target is first module", () => {
    const focus = derivePracticeFocus(memberIds, "natural-bids");
    expect(focus.prerequisiteModuleIds).toEqual([]);
    expect(focus.targetModuleIds).toEqual(["natural-bids"]);
    expect(focus.followUpModuleIds).toEqual([
      "stayman",
      "jacoby-transfers",
      "smolen",
    ]);
  });

  it("has no follow-ups when target is last module", () => {
    const focus = derivePracticeFocus(memberIds, "smolen");
    expect(focus.prerequisiteModuleIds).toEqual([
      "natural-bids",
      "stayman",
      "jacoby-transfers",
    ]);
    expect(focus.targetModuleIds).toEqual(["smolen"]);
    expect(focus.followUpModuleIds).toEqual([]);
  });

  it("handles single-module memberIds", () => {
    const focus = derivePracticeFocus(["stayman"], "stayman");
    expect(focus.prerequisiteModuleIds).toEqual([]);
    expect(focus.targetModuleIds).toEqual(["stayman"]);
    expect(focus.followUpModuleIds).toEqual([]);
  });

  it("passes through backgroundModuleIds when provided", () => {
    const focus = derivePracticeFocus(memberIds, "stayman", ["blackwood"]);
    expect(focus.backgroundModuleIds).toEqual(["blackwood"]);
    expect(focus.targetModuleIds).toEqual(["stayman"]);
  });

  it("defaults backgroundModuleIds to empty when not provided", () => {
    const focus = derivePracticeFocus(memberIds, "stayman");
    expect(focus.backgroundModuleIds).toEqual([]);
  });

  it("passes backgroundModuleIds through all return paths", () => {
    const bg = ["blackwood"];
    // No target
    expect(derivePracticeFocus(memberIds, undefined, bg).backgroundModuleIds).toEqual(bg);
    // Unknown target (fallback)
    expect(derivePracticeFocus(memberIds, "nonexistent", bg).backgroundModuleIds).toEqual(bg);
    // Valid target
    expect(derivePracticeFocus(memberIds, "stayman", bg).backgroundModuleIds).toEqual(bg);
  });
});
