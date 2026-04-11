import { describe, test, expect } from "vitest";
import { Seat, Vulnerability } from "../types";
import { isVulnerable } from "../scoring";

describe("isVulnerable", () => {
  test("NS vulnerability with North declarer returns true", () => {
    expect(isVulnerable(Seat.North, Vulnerability.NorthSouth)).toBe(true);
  });

  test("NS vulnerability with South declarer returns true", () => {
    expect(isVulnerable(Seat.South, Vulnerability.NorthSouth)).toBe(true);
  });

  test("NS vulnerability with East declarer returns false", () => {
    expect(isVulnerable(Seat.East, Vulnerability.NorthSouth)).toBe(false);
  });

  test("NS vulnerability with West declarer returns false", () => {
    expect(isVulnerable(Seat.West, Vulnerability.NorthSouth)).toBe(false);
  });

  test("EW vulnerability with East declarer returns true", () => {
    expect(isVulnerable(Seat.East, Vulnerability.EastWest)).toBe(true);
  });

  test("EW vulnerability with North declarer returns false", () => {
    expect(isVulnerable(Seat.North, Vulnerability.EastWest)).toBe(false);
  });

  test("Both vulnerability always returns true", () => {
    expect(isVulnerable(Seat.North, Vulnerability.Both)).toBe(true);
    expect(isVulnerable(Seat.East, Vulnerability.Both)).toBe(true);
    expect(isVulnerable(Seat.South, Vulnerability.Both)).toBe(true);
    expect(isVulnerable(Seat.West, Vulnerability.Both)).toBe(true);
  });

  test("None vulnerability always returns false", () => {
    expect(isVulnerable(Seat.North, Vulnerability.None)).toBe(false);
    expect(isVulnerable(Seat.East, Vulnerability.None)).toBe(false);
    expect(isVulnerable(Seat.South, Vulnerability.None)).toBe(false);
    expect(isVulnerable(Seat.West, Vulnerability.None)).toBe(false);
  });
});
