import { describe, expect, it } from "vitest";
import { decision, bid, fallback, validateTree } from "../../core/rule-tree";
import { hcpMin, isOpener, isResponder } from "../../core/conditions";

const dummyBid = bid("test-bid", "Test bid", () => ({ type: "pass" as const }));

describe("validateTree()", () => {
  it("accepts a tree with only auction conditions", () => {
    const tree = decision(
      "check-opener",
      isOpener(),
      dummyBid,
      fallback(),
    );
    expect(() => validateTree(tree)).not.toThrow();
  });

  it("accepts a tree with only hand conditions", () => {
    const tree = decision(
      "check-hcp",
      hcpMin(10),
      dummyBid,
      fallback(),
    );
    expect(() => validateTree(tree)).not.toThrow();
  });

  it("accepts auction conditions followed by hand conditions", () => {
    const tree = decision(
      "check-opener",
      isOpener(),
      decision(
        "check-hcp",
        hcpMin(10),
        dummyBid,
        fallback(),
      ),
      fallback(),
    );
    expect(() => validateTree(tree)).not.toThrow();
  });

  it("throws when auction condition appears after hand condition", () => {
    const tree = decision(
      "check-hcp",
      hcpMin(10),
      decision(
        "check-opener",
        isOpener(),
        dummyBid,
        fallback(),
      ),
      fallback(),
    );
    expect(() => validateTree(tree)).toThrow(/auction condition.*after.*hand/i);
  });

  it("throws when auction condition appears after hand condition on NO branch", () => {
    const tree = decision(
      "check-hcp",
      hcpMin(10),
      dummyBid,
      decision(
        "check-responder",
        isResponder(),
        dummyBid,
        fallback(),
      ),
    );
    expect(() => validateTree(tree)).toThrow(/auction condition.*after.*hand/i);
  });

  it("accepts a BidNode root", () => {
    expect(() => validateTree(dummyBid)).not.toThrow();
  });

  it("accepts a FallbackNode root", () => {
    expect(() => validateTree(fallback())).not.toThrow();
  });
});
