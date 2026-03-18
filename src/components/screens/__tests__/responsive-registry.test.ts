import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { SCREEN_REGISTRY } from "../responsive-registry";
import type { ScreenEntry, MobileStrategy } from "../responsive-registry";

const SCREENS_DIR = path.resolve(__dirname, "..");

/** Recursively find all .svelte files relative to screensDir. */
function discoverSvelteFiles(dir: string, base: string = ""): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      // Skip __tests__ directories
      if (entry.name === "__tests__") continue;
      results.push(...discoverSvelteFiles(path.join(dir, entry.name), relPath));
    } else if (entry.name.endsWith(".svelte")) {
      results.push(relPath);
    }
  }
  return results;
}

const discoveredFiles = discoverSvelteFiles(SCREENS_DIR);
const registeredPaths = new Set(SCREEN_REGISTRY.map((e) => e.path));

describe("responsive-registry completeness", () => {
  it("discovers at least one .svelte file (sanity check)", () => {
    expect(discoveredFiles.length).toBeGreaterThan(0);
  });

  // Generate a test case for each discovered file
  for (const file of discoveredFiles) {
    it(`${file} is registered in SCREEN_REGISTRY`, () => {
      expect(
        registeredPaths.has(file),
        `Screen file "${file}" is not in SCREEN_REGISTRY. ` +
        `Add an entry to src/components/screens/responsive-registry.ts ` +
        `with its mobile layout strategy.`,
      ).toBe(true);
    });
  }
});

describe("responsive-registry has no stale entries", () => {
  for (const entry of SCREEN_REGISTRY) {
    it(`${entry.path} exists on disk`, () => {
      const fullPath = path.join(SCREENS_DIR, entry.path);
      expect(
        fs.existsSync(fullPath),
        `Registry entry "${entry.path}" points to a non-existent file. ` +
        `Remove it from SCREEN_REGISTRY or fix the path.`,
      ).toBe(true);
    });
  }
});

describe("responsive-registry mobile constraints", () => {
  const VALID_STRATEGIES: MobileStrategy[] = [
    "stack", "centered", "sidebar-overlay", "embedded", "full-width",
  ];

  const topLevelEntries = SCREEN_REGISTRY.filter(
    (e) => e.mobileStrategy !== "embedded",
  );

  const embeddedEntries = SCREEN_REGISTRY.filter(
    (e) => e.mobileStrategy === "embedded",
  );

  it("every entry has a valid mobileStrategy", () => {
    for (const entry of SCREEN_REGISTRY) {
      expect(
        VALID_STRATEGIES,
        `"${entry.path}" has invalid mobileStrategy "${entry.mobileStrategy}"`,
      ).toContain(entry.mobileStrategy);
    }
  });

  it("every entry has a non-empty mobileNotes", () => {
    for (const entry of SCREEN_REGISTRY) {
      expect(
        entry.mobileNotes.trim().length,
        `"${entry.path}" has empty mobileNotes — describe its mobile behavior`,
      ).toBeGreaterThan(0);
    }
  });

  it("every top-level screen supports iPhone SE width (375px)", () => {
    for (const entry of topLevelEntries) {
      expect(
        entry.minWidth,
        `"${entry.path}" has minWidth ${entry.minWidth} > 375. ` +
        `Top-level screens must support iPhone SE (375px).`,
      ).toBeLessThanOrEqual(375);
    }
  });

  it("every entry has a positive minWidth", () => {
    for (const entry of SCREEN_REGISTRY) {
      expect(
        entry.minWidth,
        `"${entry.path}" has non-positive minWidth`,
      ).toBeGreaterThan(0);
    }
  });

  it("no duplicate paths in registry", () => {
    const paths = SCREEN_REGISTRY.map((e) => e.path);
    const unique = new Set(paths);
    expect(
      paths.length,
      `Duplicate paths found in SCREEN_REGISTRY: ${paths.filter((p, i) => paths.indexOf(p) !== i).join(", ")}`,
    ).toBe(unique.size);
  });
});
