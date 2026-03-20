import { describe, it, expect } from "vitest";
import { getBaseModules } from "../../core/protocol/types";
import { BRIDGE_SEMANTIC_SCHEMA } from "../../core/protocol/bridge-schema";
import { ntConventionSpec } from "../nt-bundle/convention-spec";
import { bergenConventionSpec } from "../bergen-bundle/convention-spec";
import { weakTwosConventionSpec } from "../weak-twos-bundle/convention-spec";
import { dontConventionSpec } from "../dont-bundle/convention-spec";

describe("ConventionSpec assemblies", () => {
  describe("ntConventionSpec", () => {
    it("has correct id and name", () => {
      expect(ntConventionSpec.id).toBe("nt-bundle");
      expect(ntConventionSpec.name).toBe("1NT Response Bundle");
    });

    it("has base modules", () => {
      const baseModules = getBaseModules(ntConventionSpec);
      expect(baseModules.length).toBeGreaterThan(0);
    });

    it("has surface fragments", () => {
      expect(Object.keys(ntConventionSpec.surfaces).length).toBeGreaterThan(0);
    });

    it("uses BRIDGE_SEMANTIC_SCHEMA", () => {
      expect(ntConventionSpec.schema).toBe(BRIDGE_SEMANTIC_SCHEMA);
    });
  });

  describe("bergenConventionSpec", () => {
    it("has correct id and name", () => {
      expect(bergenConventionSpec.id).toBe("bergen-bundle");
      expect(bergenConventionSpec.name).toBe("Bergen Raises");
    });

    it("has base modules", () => {
      const baseModules = getBaseModules(bergenConventionSpec);
      expect(baseModules.length).toBeGreaterThan(0);
    });

    it("has surface fragments", () => {
      expect(Object.keys(bergenConventionSpec.surfaces).length).toBeGreaterThan(0);
    });

    it("uses BRIDGE_SEMANTIC_SCHEMA", () => {
      expect(bergenConventionSpec.schema).toBe(BRIDGE_SEMANTIC_SCHEMA);
    });
  });

  describe("weakTwosConventionSpec", () => {
    it("has correct id and name", () => {
      expect(weakTwosConventionSpec.id).toBe("weak-twos-bundle");
      expect(weakTwosConventionSpec.name).toBe("Weak Two Bids");
    });

    it("has base modules", () => {
      const baseModules = getBaseModules(weakTwosConventionSpec);
      expect(baseModules.length).toBeGreaterThan(0);
    });

    it("has surface fragments", () => {
      expect(Object.keys(weakTwosConventionSpec.surfaces).length).toBeGreaterThan(0);
    });

    it("uses BRIDGE_SEMANTIC_SCHEMA", () => {
      expect(weakTwosConventionSpec.schema).toBe(BRIDGE_SEMANTIC_SCHEMA);
    });
  });

  describe("dontConventionSpec", () => {
    it("has correct id and name", () => {
      expect(dontConventionSpec.id).toBe("dont-bundle");
      expect(dontConventionSpec.name).toBe("DONT (Disturb Opponents' Notrump)");
    });

    it("has base modules", () => {
      const baseModules = getBaseModules(dontConventionSpec);
      expect(baseModules.length).toBeGreaterThan(0);
    });

    it("has surface fragments", () => {
      expect(Object.keys(dontConventionSpec.surfaces).length).toBeGreaterThan(0);
    });

    it("uses BRIDGE_SEMANTIC_SCHEMA", () => {
      expect(dontConventionSpec.schema).toBe(BRIDGE_SEMANTIC_SCHEMA);
    });
  });
});
