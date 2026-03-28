import { describe, it, expect } from "vitest";
import { resolveAlert, isAlertable } from "../evaluation/alert";
import type { AlertResolvable } from "../evaluation/alert";
import { bidName, bidSummary } from "../../core/authored-text";
import type { TeachingLabel } from "../../core/authored-text";

const tl = (name: string): TeachingLabel => ({ name: bidName(name), summary: bidSummary("[TODO] test") });

function makeSurface(overrides: Partial<AlertResolvable> = {}): AlertResolvable {
  return {
    disclosure: "alert",
    teachingLabel: tl("Test bid"),
    clauses: [],
    ...overrides,
  };
}

describe("isAlertable", () => {
  it("returns false for natural disclosure", () => {
    expect(isAlertable("natural")).toBe(false);
  });

  it("returns true for alert disclosure", () => {
    expect(isAlertable("alert")).toBe(true);
  });

  it("returns true for announcement disclosure", () => {
    expect(isAlertable("announcement")).toBe(true);
  });

  it("returns true for standard disclosure", () => {
    expect(isAlertable("standard")).toBe(true);
  });
});

describe("resolveAlert", () => {
  it("returns null for natural disclosure", () => {
    const surface = makeSurface({ disclosure: "natural" });
    expect(resolveAlert(surface)).toBeNull();
  });

  it("returns alert for alert disclosure with clauses (isPublic preserved on constraints)", () => {
    const surface = makeSurface({
      disclosure: "alert",
      teachingLabel: tl("Constructive raise (3C)"),
      clauses: [
        { clauseId: "hcp-8", factId: "hand.hcp", operator: "gte", value: 8, isPublic: true },
      ],
    });
    const result = resolveAlert(surface);
    expect(result).toEqual({
      teachingLabel: "Constructive raise (3C)",
      annotationType: "alert",
    });
  });

  it("returns educational for standard disclosure (e.g., Stayman)", () => {
    const surface = makeSurface({
      disclosure: "standard",
      teachingLabel: tl("Stayman 2♣"),
    });
    const result = resolveAlert(surface);
    expect(result?.annotationType).toBe("educational");
  });

  it("returns alert for alert disclosure (DONTBothMajors)", () => {
    const surface = makeSurface({
      disclosure: "alert",
      teachingLabel: tl("2H — both majors"),
    });
    const result = resolveAlert(surface);
    expect(result).toEqual({
      teachingLabel: "2H — both majors",
      annotationType: "alert",
    });
  });

  it("returns alert for alert disclosure (artificial)", () => {
    const surface = makeSurface({
      disclosure: "alert",
      teachingLabel: tl("Relay bid"),
    });
    const result = resolveAlert(surface);
    expect(result).toEqual({
      teachingLabel: "Relay bid",
      annotationType: "alert",
    });
  });

  it("returns announce annotationType for announcement disclosure", () => {
    const surface = makeSurface({
      disclosure: "announcement",
      teachingLabel: tl("Transfer to hearts"),
    });
    const result = resolveAlert(surface);
    expect(result?.annotationType).toBe("announce");
  });

  it("returns null for natural disclosure (pass)", () => {
    const surface = makeSurface({
      disclosure: "natural",
      teachingLabel: tl("Pass"),
    });
    expect(resolveAlert(surface)).toBeNull();
  });
});
