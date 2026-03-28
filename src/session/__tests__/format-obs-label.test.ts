import { describe, it, expect } from "vitest";
import { formatObsAction, formatTransitionLabel } from "../format-obs-label";
import { BID_ACTION_TYPES } from "../../conventions/pipeline/bid-action";
import type { ObsPattern } from "../../conventions";
import type { Call } from "../../engine/types";
import { BidSuit } from "../../engine/types";

describe("formatObsAction", () => {
  it("open with strain", () => {
    expect(formatObsAction({ act: "open", strain: "notrump" })).toBe("opening notrump");
  });
  it("show with feature and suit", () => {
    expect(formatObsAction({ act: "show", feature: "heldSuit", suit: "hearts" })).toBe("showing hearts");
  });
  it("deny with feature", () => {
    expect(formatObsAction({ act: "deny", feature: "majorSuit" })).toBe("denying a major");
  });
  it("inquire with feature", () => {
    expect(formatObsAction({ act: "inquire", feature: "majorSuit" })).toBe("asking for a major");
  });
  it("transfer with suit", () => {
    expect(formatObsAction({ act: "transfer", suit: "hearts" })).toBe("transferring to hearts");
  });
  it("pass", () => {
    expect(formatObsAction({ act: "pass" })).toBe("passing");
  });
  it("exhaustiveness — all act types produce output", () => {
    const results: Record<string, string> = {};
    for (const act of BID_ACTION_TYPES) {
      results[act] = formatObsAction({ act } as ObsPattern);
    }
    expect(Object.keys(results).length).toBe(BID_ACTION_TYPES.length);
    for (const val of Object.values(results)) {
      expect(val.length).toBeGreaterThan(0);
    }
  });
});

describe("formatTransitionLabel", () => {
  const heartsObs: ObsPattern = { act: "show", feature: "heldSuit", suit: "hearts" };
  const twoHearts: Call = { type: "bid", level: 2, strain: BidSuit.Hearts };
  it("full label with call and turn", () => {
    expect(formatTransitionLabel(heartsObs, twoHearts, "opener")).toBe(
      "After opener bids 2\u2665 (showing hearts)",
    );
  });
  it("label without call", () => {
    expect(formatTransitionLabel(heartsObs, null, "opener")).toBe(
      "After opener showing hearts",
    );
  });
  it("label without turn", () => {
    expect(formatTransitionLabel(heartsObs, twoHearts, null)).toBe(
      "After bids 2\u2665 (showing hearts)",
    );
  });
});
