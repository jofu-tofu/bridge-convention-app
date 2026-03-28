import { describe, test, expect } from "vitest";
import {
  bidName,
  bidSummary,
  moduleDescription,
  modulePurpose,
  teachingTradeoff,
  teachingPrinciple,
  teachingItem,
  teachingLabel,
} from "../authored-text";

// ---------------------------------------------------------------------------
// bidName — range [2, 40]
// ---------------------------------------------------------------------------
describe("bidName", () => {
  test("accepts valid string within range", () => {
    expect(bidName("1NT")).toBe("1NT");
  });

  test("accepts exact min length (2)", () => {
    expect(bidName("NT")).toBe("NT");
  });

  test("accepts exact max length (40)", () => {
    const s = "a".repeat(40);
    expect(bidName(s)).toBe(s);
  });

  test("throws on too-short string", () => {
    expect(() => bidName("X")).toThrow("BidName: length 1 out of range [2, 40]");
  });

  test("throws on too-long string", () => {
    const s = "a".repeat(41);
    expect(() => bidName(s)).toThrow("BidName: length 41 out of range [2, 40]");
  });

  test("trims whitespace before validation", () => {
    expect(bidName("  1NT  ")).toBe("1NT");
  });

  test("trimmed string that is too short throws", () => {
    expect(() => bidName("   X   ")).toThrow("BidName: length 1 out of range [2, 40]");
  });
});

// ---------------------------------------------------------------------------
// bidSummary — range [5, 200]
// ---------------------------------------------------------------------------
describe("bidSummary", () => {
  test("accepts valid string within range", () => {
    expect(bidSummary("Shows 4+ hearts")).toBe("Shows 4+ hearts");
  });

  test("accepts exact min length (5)", () => {
    expect(bidSummary("abcde")).toBe("abcde");
  });

  test("accepts exact max length (200)", () => {
    const s = "x".repeat(200);
    expect(bidSummary(s)).toBe(s);
  });

  test("throws on too-short string", () => {
    expect(() => bidSummary("abcd")).toThrow("BidSummary: length 4 out of range [5, 200]");
  });

  test("throws on too-long string", () => {
    expect(() => bidSummary("x".repeat(201))).toThrow("out of range [5, 200]");
  });

  test("trims whitespace before validation", () => {
    expect(bidSummary("  hello world  ")).toBe("hello world");
  });
});

// ---------------------------------------------------------------------------
// moduleDescription — range [10, 300]
// ---------------------------------------------------------------------------
describe("moduleDescription", () => {
  test("accepts valid string", () => {
    const desc = "Stayman convention for finding major-suit fits";
    expect(moduleDescription(desc)).toBe(desc);
  });

  test("accepts exact min length (10)", () => {
    expect(moduleDescription("a".repeat(10))).toBe("a".repeat(10));
  });

  test("accepts exact max length (300)", () => {
    expect(moduleDescription("b".repeat(300))).toBe("b".repeat(300));
  });

  test("throws on too-short string", () => {
    expect(() => moduleDescription("too short")).toThrow(
      "ModuleDescription: length 9 out of range [10, 300]",
    );
  });

  test("throws on too-long string", () => {
    expect(() => moduleDescription("c".repeat(301))).toThrow("out of range [10, 300]");
  });
});

// ---------------------------------------------------------------------------
// modulePurpose — range [10, 300]
// ---------------------------------------------------------------------------
describe("modulePurpose", () => {
  test("accepts valid string", () => {
    expect(modulePurpose("Find a 4-4 major fit after 1NT")).toBe(
      "Find a 4-4 major fit after 1NT",
    );
  });

  test("throws on too-short string", () => {
    expect(() => modulePurpose("short")).toThrow("out of range [10, 300]");
  });
});

// ---------------------------------------------------------------------------
// teachingTradeoff — range [10, 500]
// ---------------------------------------------------------------------------
describe("teachingTradeoff", () => {
  test("accepts valid string", () => {
    const text = "Sacrifices natural 2C bid for major-suit transfer";
    expect(teachingTradeoff(text)).toBe(text);
  });

  test("throws on too-short string", () => {
    expect(() => teachingTradeoff("too short")).toThrow("out of range [10, 500]");
  });
});

// ---------------------------------------------------------------------------
// teachingPrinciple — range [10, 500]
// ---------------------------------------------------------------------------
describe("teachingPrinciple", () => {
  test("accepts valid string", () => {
    const text = "Always prefer the major suit game over notrump";
    expect(teachingPrinciple(text)).toBe(text);
  });

  test("throws on too-short string", () => {
    expect(() => teachingPrinciple("too short")).toThrow("out of range [10, 500]");
  });
});

// ---------------------------------------------------------------------------
// teachingItem — range [5, 300]
// ---------------------------------------------------------------------------
describe("teachingItem", () => {
  test("accepts valid string", () => {
    expect(teachingItem("Bid 2C with 4+ in a major")).toBe("Bid 2C with 4+ in a major");
  });

  test("throws on too-short string", () => {
    expect(() => teachingItem("abcd")).toThrow("TeachingItem: length 4 out of range [5, 300]");
  });
});

// ---------------------------------------------------------------------------
// teachingLabel — convenience builder
// ---------------------------------------------------------------------------
describe("teachingLabel", () => {
  test("builds a TeachingLabel from name + summary strings", () => {
    const label = teachingLabel("Stayman", "Asks opener for a 4-card major");
    expect(label).toEqual({
      name: "Stayman",
      summary: "Asks opener for a 4-card major",
    });
  });

  test("trims both name and summary", () => {
    const label = teachingLabel("  Stayman  ", "  Asks opener for a 4-card major  ");
    expect(label.name).toBe("Stayman");
    expect(label.summary).toBe("Asks opener for a 4-card major");
  });

  test("throws when name is invalid", () => {
    expect(() => teachingLabel("X", "Valid summary text")).toThrow("BidName");
  });

  test("throws when summary is invalid", () => {
    expect(() => teachingLabel("Stayman", "bad")).toThrow("BidSummary");
  });
});

// ---------------------------------------------------------------------------
// Structural: no [TODO] surface summaries in registered modules
// ---------------------------------------------------------------------------
describe("authored-text content audit", () => {
  test("no surface summary starts with [TODO]", async () => {
    const { getAllModules } = await import("../../definitions/module-registry");
    const { moduleSurfaces } = await import("../convention-module");

    const modules = getAllModules();
    const violations: string[] = [];

    for (const mod of modules) {
      for (const surface of moduleSurfaces(mod)) {
        const summary = surface.teachingLabel?.summary;
        if (typeof summary === "string" && summary.startsWith("[TODO]")) {
          violations.push(`${mod.moduleId} / ${surface.meaningId}: ${summary}`);
        }
      }
    }

    expect(violations, `Surfaces with [TODO] summaries:\n${violations.join("\n")}`).toHaveLength(
      0,
    );
  });
});
