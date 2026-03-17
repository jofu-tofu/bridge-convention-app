/**
 * Golden-master characterization tests for DONT bundle composition.
 *
 * These tests capture the current bundle properties so that migrating
 * from composeDontModules() to compileProfileFromPackages() can be
 * verified as behavior-preserving.
 */
import { describe, it, expect } from "vitest";
import { dontBundle } from "../config";

describe("DONT bundle composition (golden-master)", () => {
  // ── Identity ──────────────────────────────────────────────────

  it("has correct bundle identity", () => {
    expect(dontBundle.id).toBe("dont-bundle");
    expect(dontBundle.name).toBe("DONT Bundle");
    expect(dontBundle.memberIds).toEqual(["dont-bundle", "dont"]);
  });

  // ── Surface groups ────────────────────────────────────────────

  it("has 9 surface groups", () => {
    expect(dontBundle.meaningSurfaces).toHaveLength(9);
  });

  it("has correct surface group IDs", () => {
    const groupIds = dontBundle.meaningSurfaces!.map((g) => g.groupId);
    expect(groupIds).toEqual([
      "overcaller-r1",
      "advancer-after-2h",
      "advancer-after-2d",
      "advancer-after-2c",
      "advancer-after-2s",
      "advancer-after-double",
      "overcaller-reveal",
      "overcaller-2c-relay",
      "overcaller-2d-relay",
    ]);
  });

  it("has 25 total surfaces across all groups", () => {
    const total = dontBundle.meaningSurfaces!.reduce(
      (acc, g) => acc + g.surfaces.length,
      0,
    );
    expect(total).toBe(25);
  });

  it("has 6 R1 entry surfaces", () => {
    const r1Group = dontBundle.meaningSurfaces!.find(
      (g) => g.groupId === "overcaller-r1",
    );
    expect(r1Group!.surfaces).toHaveLength(6);
  });

  // ── Conversation machine ──────────────────────────────────────

  it("has a conversation machine", () => {
    expect(dontBundle.conversationMachine).toBeDefined();
    expect(dontBundle.conversationMachine!.machineId).toBe("dont-conversation");
  });

  it("machine has 21 states", () => {
    // 5 skeleton (idle, dont-active, overcaller-r1, terminal, dont-contested)
    // + 16 module (wait-advancer-*, advancer-after-*, wait-relay-*, overcaller-relay-*)
    expect(dontBundle.conversationMachine!.states.size).toBe(21);
  });

  it("machine contains all required state IDs", () => {
    const stateIds = Array.from(dontBundle.conversationMachine!.states.keys());
    const required = [
      "idle",
      "dont-active",
      "overcaller-r1",
      "wait-advancer-2h",
      "wait-advancer-2d",
      "wait-advancer-2c",
      "wait-advancer-2s",
      "wait-advancer-double",
      "advancer-after-2h",
      "advancer-after-2d",
      "advancer-after-2c",
      "advancer-after-2s",
      "advancer-after-double",
      "wait-reveal",
      "overcaller-reveal",
      "wait-2d-relay",
      "overcaller-2d-relay",
      "wait-2c-relay",
      "overcaller-2c-relay",
      "terminal",
      "dont-contested",
    ];
    for (const id of required) {
      expect(stateIds, `missing state: ${id}`).toContain(id);
    }
  });

  it("preserves parent-child hierarchy (dont-active parent)", () => {
    const machine = dontBundle.conversationMachine!;
    const childStates = [
      "overcaller-r1",
      "wait-advancer-2h",
      "wait-advancer-2d",
      "wait-advancer-2c",
      "wait-advancer-2s",
      "wait-advancer-double",
      "advancer-after-2h",
      "advancer-after-2d",
      "advancer-after-2c",
      "advancer-after-2s",
      "advancer-after-double",
      "wait-reveal",
      "overcaller-reveal",
      "wait-2d-relay",
      "overcaller-2d-relay",
      "wait-2c-relay",
      "overcaller-2c-relay",
      "dont-contested",
    ];
    for (const stateId of childStates) {
      const state = machine.states.get(stateId);
      expect(state?.parentId, `${stateId} should have parent dont-active`).toBe(
        "dont-active",
      );
    }
  });

  it("idle and terminal states have null parentId", () => {
    const machine = dontBundle.conversationMachine!;
    expect(machine.states.get("idle")?.parentId).toBeNull();
    expect(machine.states.get("terminal")?.parentId).toBeNull();
    expect(machine.states.get("dont-active")?.parentId).toBeNull();
  });

  // ── Fact extensions ───────────────────────────────────────────

  it("has 1 fact extension", () => {
    expect(dontBundle.factExtensions).toHaveLength(1);
  });

  it("fact extension has 20 definitions", () => {
    const defs = dontBundle.factExtensions![0]!.definitions;
    expect(defs).toHaveLength(20);
  });

  it("fact extension has 20 evaluators", () => {
    const evals = dontBundle.factExtensions![0]!.evaluators;
    expect(evals.size).toBe(20);
  });

  // ── Explanation catalog ───────────────────────────────────────

  it("has an explanation catalog with entries", () => {
    expect(dontBundle.explanationCatalog).toBeDefined();
    expect(dontBundle.explanationCatalog!.entries.length).toBeGreaterThan(0);
  });

  // ── Pedagogical relations ─────────────────────────────────────

  it("has pedagogical relations", () => {
    expect(dontBundle.pedagogicalRelations).toBeDefined();
    expect(dontBundle.pedagogicalRelations!.length).toBeGreaterThan(0);
  });

  it("has correct number of pedagogical relations", () => {
    expect(dontBundle.pedagogicalRelations!.length).toBe(22);
  });

  // ── Surface router ────────────────────────────────────────────

  it("has a surface router function", () => {
    expect(typeof dontBundle.surfaceRouter).toBe("function");
  });

  // ── System profile ────────────────────────────────────────────

  it("has system profile", () => {
    expect(dontBundle.systemProfile).toBeDefined();
    expect(dontBundle.systemProfile!.profileId).toBe("dont-sayc");
  });

  it("system profile has dont module entry", () => {
    const profile = dontBundle.systemProfile!;
    expect(profile.modules).toHaveLength(1);
    expect(profile.modules[0]!.moduleId).toBe("dont");
    expect(profile.modules[0]!.kind).toBe("add-on");
  });

  // ── Capabilities ──────────────────────────────────────────────

  it("declares opponent-1nt capability", () => {
    expect(dontBundle.declaredCapabilities).toBeDefined();
    expect(Object.keys(dontBundle.declaredCapabilities!)).toContain(
      "opponent.1nt",
    );
  });
});
