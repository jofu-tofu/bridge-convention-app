import { describe, it, expect } from "vitest";
import { resolveAlert, isAlertable } from "../evaluation/alert";
import type { AlertResolvable } from "../evaluation/alert";
import { Disclosure, FactOperator } from "../evaluation/meaning";
import { bidName, bidSummary } from "../../core/authored-text";
import type { TeachingLabel } from "../../core/authored-text";

const tl = (name: string): TeachingLabel => ({ name: bidName(name), summary: bidSummary("[TODO] test") });

function makeSurface(overrides: Partial<AlertResolvable> = {}): AlertResolvable {
  return {
    disclosure: Disclosure.Alert,
    teachingLabel: tl("Test bid"),
    clauses: [],
    ...overrides,
  };
}

describe("isAlertable", () => {
  it("returns false for natural disclosure", () => {
    expect(isAlertable(Disclosure.Natural)).toBe(false);
  });

  it("returns true for alert disclosure", () => {
    expect(isAlertable(Disclosure.Alert)).toBe(true);
  });

  it("returns true for announcement disclosure", () => {
    expect(isAlertable(Disclosure.Announcement)).toBe(true);
  });

  it("returns true for standard disclosure", () => {
    expect(isAlertable(Disclosure.Standard)).toBe(true);
  });
});

describe("resolveAlert", () => {
  it("returns null for natural disclosure", () => {
    const surface = makeSurface({ disclosure: Disclosure.Natural });
    expect(resolveAlert(surface)).toBeNull();
  });

  it("returns alert for alert disclosure with clauses (isPublic preserved on constraints)", () => {
    const surface = makeSurface({
      disclosure: Disclosure.Alert,
      teachingLabel: tl("Constructive raise (3C)"),
      clauses: [
        { clauseId: "hcp-8", factId: "hand.hcp", operator: FactOperator.Gte, value: 8, isPublic: true },
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
      disclosure: Disclosure.Standard,
      teachingLabel: tl("Stayman 2\u2663"),
    });
    const result = resolveAlert(surface);
    expect(result?.annotationType).toBe("educational");
  });

  it("returns alert for alert disclosure (DONTBothMajors)", () => {
    const surface = makeSurface({
      disclosure: Disclosure.Alert,
      teachingLabel: tl("2H \u2014 both majors"),
    });
    const result = resolveAlert(surface);
    expect(result).toEqual({
      teachingLabel: "2H \u2014 both majors",
      annotationType: "alert",
    });
  });

  it("returns alert for alert disclosure (artificial)", () => {
    const surface = makeSurface({
      disclosure: Disclosure.Alert,
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
      disclosure: Disclosure.Announcement,
      teachingLabel: tl("Transfer to hearts"),
    });
    const result = resolveAlert(surface);
    expect(result?.annotationType).toBe("announce");
  });

  it("returns null for natural disclosure (pass)", () => {
    const surface = makeSurface({
      disclosure: Disclosure.Natural,
      teachingLabel: tl("Pass"),
    });
    expect(resolveAlert(surface)).toBeNull();
  });
});
