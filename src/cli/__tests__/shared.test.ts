import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpponentMode } from "../../service/session-types";
import {
  parseArgs,
  requireArg,
  optionalNumericArg,
  parseVulnerability,
  parseOpponentMode,
  parseScenarioConfig,
  assignSeedScenario,
  formatHandBySuit,
  Vulnerability,
  type ScenarioConfig,
} from "../shared";

// ── Process.exit / console.error mocking ────────────────────────────

let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
    throw new Error("process.exit");
  }) as any) as ReturnType<typeof vi.spyOn>;
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ── parseArgs ───────────────────────────────────────────────────────

describe("parseArgs", () => {
  it("parses --key=value pairs", () => {
    expect(parseArgs(["--name=alice"])).toEqual({ name: "alice" });
  });

  it("parses bare --flag as true", () => {
    expect(parseArgs(["--verbose"])).toEqual({ verbose: true });
  });

  it("handles mixed args", () => {
    expect(parseArgs(["--out=file.txt", "--verbose", "--count=3"])).toEqual({
      out: "file.txt",
      verbose: true,
      count: "3",
    });
  });

  it("ignores non-flag (positional) args", () => {
    expect(parseArgs(["positional", "-short", "--real=val"])).toEqual({ real: "val" });
  });

  it("returns empty object for empty array", () => {
    expect(parseArgs([])).toEqual({});
  });

  it("handles --key= (empty value)", () => {
    expect(parseArgs(["--key="])).toEqual({ key: "" });
  });
});

// ── requireArg ──────────────────────────────────────────────────────

describe("requireArg", () => {
  it("returns string value when present", () => {
    expect(requireArg({ name: "alice" }, "name")).toBe("alice");
  });

  it("exits when arg is missing", () => {
    expect(() => requireArg({}, "name")).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it("exits when arg is boolean (bare flag)", () => {
    expect(() => requireArg({ name: true }, "name")).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});

// ── optionalNumericArg ──────────────────────────────────────────────

describe("optionalNumericArg", () => {
  it("returns number for valid numeric string", () => {
    expect(optionalNumericArg({ count: "42" }, "count")).toBe(42);
  });

  it("returns undefined when arg is missing", () => {
    expect(optionalNumericArg({}, "count")).toBeUndefined();
  });

  it("returns undefined when arg is bare flag (true)", () => {
    expect(optionalNumericArg({ count: true }, "count")).toBeUndefined();
  });

  it("exits for non-numeric string", () => {
    expect(() => optionalNumericArg({ count: "abc" }, "count")).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});

// ── parseVulnerability ──────────────────────────────────────────────

describe("parseVulnerability", () => {
  it("defaults to Vulnerability.None when no --vuln", () => {
    expect(parseVulnerability({})).toBe(Vulnerability.None);
  });

  it.each([
    ["none", Vulnerability.None],
    ["ns", Vulnerability.NorthSouth],
    ["ew", Vulnerability.EastWest],
    ["both", Vulnerability.Both],
  ] as const)("maps '%s' to %s", (input, expected) => {
    expect(parseVulnerability({ vuln: input })).toBe(expected);
  });

  it("is case-insensitive", () => {
    expect(parseVulnerability({ vuln: "NS" })).toBe(Vulnerability.NorthSouth);
    expect(parseVulnerability({ vuln: "Both" })).toBe(Vulnerability.Both);
  });

  it("exits for invalid value", () => {
    expect(() => parseVulnerability({ vuln: "bad" })).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});

// ── parseOpponentMode ───────────────────────────────────────────────

describe("parseOpponentMode", () => {
  it("defaults to 'natural' when no --opponents", () => {
    expect(parseOpponentMode({})).toBe("natural");
  });

  it.each(["natural", "none"] as const)("returns '%s'", (mode) => {
    expect(parseOpponentMode({ opponents: mode })).toBe(mode);
  });

  it("exits for invalid value", () => {
    expect(() => parseOpponentMode({ opponents: "bad" })).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});

// ── parseScenarioConfig ─────────────────────────────────────────────

describe("parseScenarioConfig", () => {
  it("default: fixed None + fixed natural", () => {
    const cfg = parseScenarioConfig({});
    expect(cfg.vuln).toEqual({ type: "fixed", value: Vulnerability.None });
    expect(cfg.opponents).toEqual({ type: "fixed", value: OpponentMode.Natural });
  });

  it("--vuln=mixed -> mixed vuln mode", () => {
    const cfg = parseScenarioConfig({ vuln: "mixed" });
    expect(cfg.vuln).toEqual({ type: "mixed" });
  });

  it("--vuln=ns -> fixed NorthSouth", () => {
    const cfg = parseScenarioConfig({ vuln: "ns" });
    expect(cfg.vuln).toEqual({ type: "fixed", value: Vulnerability.NorthSouth });
  });

  it("--opponents=mixed -> mixed with naturalRate 0.5", () => {
    const cfg = parseScenarioConfig({ opponents: "mixed" });
    expect(cfg.opponents).toEqual({ type: "mixed", naturalRate: 0.5 });
  });

  it("--opponents=none -> fixed none", () => {
    const cfg = parseScenarioConfig({ opponents: "none" });
    expect(cfg.opponents).toEqual({ type: "fixed", value: OpponentMode.None });
  });
});

// ── assignSeedScenario ──────────────────────────────────────────────

describe("assignSeedScenario", () => {
  const fixedConfig: ScenarioConfig = {
    vuln: { type: "fixed", value: Vulnerability.EastWest },
    opponents: { type: "fixed", value: OpponentMode.None },
  };

  const mixedConfig: ScenarioConfig = {
    vuln: { type: "mixed" },
    opponents: { type: "mixed", naturalRate: 0.5 },
  };

  it("fixed config returns the fixed values", () => {
    const result = assignSeedScenario(123, fixedConfig);
    expect(result.vulnerability).toBe(Vulnerability.EastWest);
    expect(result.opponents).toBe("none");
  });

  it("mixed config is deterministic (same seed = same result)", () => {
    const a = assignSeedScenario(42, mixedConfig);
    const b = assignSeedScenario(42, mixedConfig);
    expect(a).toEqual(b);
  });

  it("different seeds can produce different results", () => {
    const results = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const r = assignSeedScenario(seed, mixedConfig);
      results.add(`${r.vulnerability}|${r.opponents}`);
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it("same seed always produces same result across calls", () => {
    const seed = 0xDEAD;
    const first = assignSeedScenario(seed, mixedConfig);
    for (let i = 0; i < 5; i++) {
      expect(assignSeedScenario(seed, mixedConfig)).toEqual(first);
    }
  });
});

// ── formatHandBySuit ────────────────────────────────────────────────

describe("formatHandBySuit", () => {
  const hand = {
    cards: [
      { suit: "S", rank: "A" },
      { suit: "S", rank: "K" },
      { suit: "H", rank: "Q" },
      { suit: "H", rank: "J" },
      { suit: "H", rank: "10" },
      { suit: "D", rank: "9" },
      { suit: "D", rank: "8" },
      { suit: "D", rank: "7" },
      { suit: "D", rank: "6" },
      { suit: "C", rank: "5" },
      { suit: "C", rank: "4" },
      { suit: "C", rank: "3" },
      { suit: "C", rank: "2" },
    ],
  } as any;

  it("groups cards by suit correctly", () => {
    const result = formatHandBySuit(hand);
    expect(result.S).toEqual(["A", "K"]);
    expect(result.H).toEqual(["Q", "J", "10"]);
    expect(result.D).toEqual(["9", "8", "7", "6"]);
    expect(result.C).toEqual(["5", "4", "3", "2"]);
  });

  it("returns rank strings (not card objects)", () => {
    const result = formatHandBySuit(hand);
    for (const suit of ["S", "H", "D", "C"]) {
      for (const rank of result[suit]!) {
        expect(typeof rank).toBe("string");
      }
    }
  });
});
