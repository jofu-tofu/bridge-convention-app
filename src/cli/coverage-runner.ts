#!/usr/bin/env -S npx tsx
// ── Bridge Convention Coverage CLI ──────────────────────────────────
//
// Enumerates coverage targets from ConventionSpec modules and
// optionally runs automated self-test sessions.
//
// Modes:
//   list     — enumerate all coverage atoms for a convention
//   summary  — show coverage stats (base states, protocol states, atoms)

import { listConventionSpecs, getConventionSpec } from "../conventions/spec-registry";
import {
  generateProtocolCoverageManifest,
  type ProtocolCoverageManifest,
} from "../conventions/core/protocol/coverage-enumeration";
import { getBaseModules, getProtocolModules } from "../conventions/core/protocol/types";

const args = process.argv.slice(2);
const mode = args[0] ?? "summary";
const conventionId = args[1];

function printUsage(): void {
  console.log("Usage: coverage-runner.ts <mode> [conventionId]");
  console.log("");
  console.log("Modes:");
  console.log("  summary  [id]   — Show coverage stats (default: all conventions)");
  console.log("  list     <id>   — List all coverage atoms for a convention");
  console.log("");
  console.log("Available conventions:");
  for (const spec of listConventionSpecs()) {
    console.log(`  ${spec.id} — ${spec.name}`);
  }
}

function printSummary(manifest: ProtocolCoverageManifest): void {
  console.log(`\n${manifest.specName} (${manifest.specId})`);
  console.log(`  Base states:     ${manifest.totalBaseStates}`);
  console.log(`  Protocol states: ${manifest.totalProtocolStates}`);
  console.log(`  Base atoms:      ${manifest.baseAtoms.length}`);
  console.log(`  Protocol atoms:  ${manifest.protocolAtoms.length}`);
  console.log(`  Total atoms:     ${manifest.totalAtoms}`);
  if (manifest.unreachable.length > 0) {
    console.log(`  Unreachable:     ${manifest.unreachable.length}`);
    for (const u of manifest.unreachable) {
      console.log(`    - ${u.stateId}: ${u.reason}`);
    }
  }
}

function printAtoms(manifest: ProtocolCoverageManifest): void {
  console.log(`\n${manifest.specName} — ${manifest.totalAtoms} coverage atoms\n`);

  if (manifest.baseAtoms.length > 0) {
    console.log("── Base Track Atoms ──");
    for (const atom of manifest.baseAtoms) {
      console.log(`  [${atom.baseStateId}] ${atom.meaningLabel} (${atom.surfaceId})`);
    }
  }

  if (manifest.protocolAtoms.length > 0) {
    console.log("\n── Protocol Atoms ──");
    for (const atom of manifest.protocolAtoms) {
      const proto = atom.activeProtocols[0];
      const protoLabel = proto ? ` via ${proto.protocolId}@${proto.stateId}` : "";
      console.log(`  [${atom.baseStateId}] ${atom.meaningLabel}${protoLabel} (${atom.surfaceId})`);
    }
  }

  if (manifest.unreachable.length > 0) {
    console.log("\n── Unreachable ──");
    for (const u of manifest.unreachable) {
      console.log(`  ${u.stateId}: ${u.reason}`);
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────

if (mode === "summary") {
  if (conventionId) {
    const spec = getConventionSpec(conventionId);
    if (!spec) {
      console.error(`Unknown convention: ${conventionId}`);
      printUsage();
      process.exit(1);
    }
    printSummary(generateProtocolCoverageManifest(spec));
  } else {
    for (const spec of listConventionSpecs()) {
      printSummary(generateProtocolCoverageManifest(spec));
    }
  }
} else if (mode === "list") {
  if (!conventionId) {
    console.error("list mode requires a convention ID");
    printUsage();
    process.exit(1);
  }
  const spec = getConventionSpec(conventionId);
  if (!spec) {
    console.error(`Unknown convention: ${conventionId}`);
    printUsage();
    process.exit(1);
  }
  printAtoms(generateProtocolCoverageManifest(spec));
} else {
  printUsage();
  process.exit(1);
}
