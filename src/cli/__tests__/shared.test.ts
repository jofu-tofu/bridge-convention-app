import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseArgs,
  requireArg,
  optionalNumericArg,
  parseVulnerability,
  parseOpponentMode,
  parseCallString,
  parsePracticeMode,
  parsePracticeRole,
  Vulnerability,
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

// ── parseCallString ─────────────────────────────────────────────────

describe("parseCallString", () => {
  it("parses pass variants", () => {
    expect(parseCallString("P")).toEqual({ type: "pass" });
    expect(parseCallString("pass")).toEqual({ type: "pass" });
  });

  it("parses double variants", () => {
    expect(parseCallString("X")).toEqual({ type: "double" });
    expect(parseCallString("dbl")).toEqual({ type: "double" });
  });

  it("parses redouble variants", () => {
    expect(parseCallString("XX")).toEqual({ type: "redouble" });
    expect(parseCallString("rdbl")).toEqual({ type: "redouble" });
  });

  it("parses contract bids", () => {
    expect(parseCallString("1C")).toEqual({ type: "bid", level: 1, strain: "C" });
    expect(parseCallString("2H")).toEqual({ type: "bid", level: 2, strain: "H" });
    expect(parseCallString("3NT")).toEqual({ type: "bid", level: 3, strain: "NT" });
    expect(parseCallString("7S")).toEqual({ type: "bid", level: 7, strain: "S" });
  });

  it("is case-insensitive", () => {
    expect(parseCallString("2c")).toEqual({ type: "bid", level: 2, strain: "C" });
    expect(parseCallString("3nt")).toEqual({ type: "bid", level: 3, strain: "NT" });
  });

  it("handles N as NT alias", () => {
    expect(parseCallString("3N")).toEqual({ type: "bid", level: 3, strain: "NT" });
  });

  it("exits for invalid bid", () => {
    expect(() => parseCallString("bad")).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it("exits for invalid level", () => {
    expect(() => parseCallString("8C")).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});

// ── parsePracticeMode ───────────────────────────────────────────────

describe("parsePracticeMode", () => {
  it("returns undefined when no --mode", () => {
    expect(parsePracticeMode({})).toBeUndefined();
  });

  it("parses valid modes", () => {
    expect(parsePracticeMode({ mode: "decision-drill" })).toBe("decision-drill");
    expect(parsePracticeMode({ mode: "full-auction" })).toBe("full-auction");
    expect(parsePracticeMode({ mode: "continuation-drill" })).toBe("continuation-drill");
  });

  it("exits for invalid mode", () => {
    expect(() => parsePracticeMode({ mode: "bad" })).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});

// ── parsePracticeRole ───────────────────────────────────────────────

describe("parsePracticeRole", () => {
  it("returns undefined when no --role", () => {
    expect(parsePracticeRole({})).toBeUndefined();
  });

  it("parses valid roles", () => {
    expect(parsePracticeRole({ role: "opener" })).toBe("opener");
    expect(parsePracticeRole({ role: "responder" })).toBe("responder");
    expect(parsePracticeRole({ role: "both" })).toBe("both");
  });

  it("exits for invalid role", () => {
    expect(() => parsePracticeRole({ role: "bad" })).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});
