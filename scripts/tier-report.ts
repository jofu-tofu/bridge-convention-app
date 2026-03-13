#!/usr/bin/env npx tsx
/**
 * tier-report.ts — Convention test tier coverage report
 *
 * Scans convention test files and counts individual test()/it() calls
 * grouped by their enclosing describe-block tier:
 *   Tier 1 "ref":        [ref:source] in describe/refDescribe block names
 *   Tier 2 "policy":     [policy] in describe/policyDescribe block names
 *   Tier 3 "structural": plain describe blocks (no tier marker)
 *   "untagged":          tests not inside any describe block
 *
 * Usage: npx tsx scripts/tier-report.ts
 * Exit:  always 0 (informational only)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// ── Paths ──────────────────────────────────────────────────────────────

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const TESTS_DIR = path.join(
  PROJECT_ROOT,
  "src",
  "conventions",
  "__tests__",
);
const SKIP_FILES = new Set(["_convention-template.test.ts"]);

// ── Types ──────────────────────────────────────────────────────────────

type Tier = "ref" | "policy" | "structural";

interface TierCounts {
  ref: number;
  policy: number;
  structural: number;
  untagged: number;
}

interface DescribeBlock {
  tier: Tier;
  bodyStart: number;
  bodyEnd: number;
}

// ── ANSI color helpers (TTY-aware) ─────────────────────────────────────

const isTTY = process.stdout.isTTY ?? false;

const C = {
  reset:  isTTY ? "\x1b[0m" : "",
  bold:   isTTY ? "\x1b[1m" : "",
  dim:    isTTY ? "\x1b[2m" : "",
  green:  isTTY ? "\x1b[32m" : "",
  yellow: isTTY ? "\x1b[33m" : "",
  cyan:   isTTY ? "\x1b[36m" : "",
};

// ── Brace matching (string/comment-aware) ──────────────────────────────

function findMatchingBrace(content: string, start: number): number {
  let depth = 1;
  let i = start;

  let inSQ = false;
  let inDQ = false;
  let inTL = false;
  let inLC = false;
  let inBC = false;

  while (i < content.length && depth > 0) {
    const ch = content[i];
    const nx = content[i + 1] ?? "";

    if (inLC) { if (ch === "\n") inLC = false; i++; continue; }
    if (inBC) { if (ch === "*" && nx === "/") { inBC = false; i += 2; continue; } i++; continue; }
    if (inSQ) { if (ch === "\\") { i += 2; continue; } if (ch === "'") inSQ = false; i++; continue; }
    if (inDQ) { if (ch === "\\") { i += 2; continue; } if (ch === '"') inDQ = false; i++; continue; }
    if (inTL) { if (ch === "\\") { i += 2; continue; } if (ch === "`") inTL = false; i++; continue; }

    if (ch === "/" && nx === "/") { inLC = true; i += 2; continue; }
    if (ch === "/" && nx === "*") { inBC = true; i += 2; continue; }
    if (ch === "'")  { inSQ = true; i++; continue; }
    if (ch === '"')  { inDQ = true; i++; continue; }
    if (ch === "`")  { inTL = true; i++; continue; }

    if (ch === "{") depth++;
    if (ch === "}") { depth--; if (depth === 0) return i; }
    i++;
  }

  return -1;
}

function skipBracedBlock(content: string, start: number): number {
  const end = findMatchingBrace(content, start + 1);
  return end === -1 ? -1 : end + 1;
}

// ── Comment-range detection ────────────────────────────────────────────

interface Range { start: number; end: number; }

/**
 * Build sorted list of ranges that are inside comments (block or line).
 * Any regex match whose index falls inside one of these ranges is a
 * false positive and should be skipped.
 */
function buildCommentRanges(content: string): Range[] {
  const ranges: Range[] = [];

  // Block comments: /* … */
  const blockRe = /\/\*[\s\S]*?\*\//g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(content)) !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
  }

  // Line comments: // … \n
  const lineRe = /\/\/.*$/gm;
  while ((m = lineRe.exec(content)) !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
  }

  ranges.sort((a, b) => a.start - b.start);
  return ranges;
}

function isInsideComment(pos: number, ranges: Range[]): boolean {
  // Binary search would be faster but linear is fine for test files
  for (const r of ranges) {
    if (r.start > pos) return false; // past possible ranges
    if (pos >= r.start && pos < r.end) return true;
  }
  return false;
}

// ── File parser ────────────────────────────────────────────────────────

function parseFile(content: string): TierCounts {
  const describes: DescribeBlock[] = [];
  const commentRanges = buildCommentRanges(content);

  // ── 1. Find describe blocks ──────────────────────────────
  const descRe =
    /\b(policyDescribe|refDescribe|describe)(?:\.\w+)*\s*\(/g;

  let dm: RegExpExecArray | null;
  while ((dm = descRe.exec(content)) !== null) {
    // Skip matches inside comments
    if (isInsideComment(dm.index, commentRanges)) continue;

    const keyword = dm[1];
    let i = dm.index + dm[0].length;

    while (i < content.length && /\s/.test(content[i])) i++;

    // ── Extract name string ─────────────────────────────────
    const q = content[i];
    if (q !== '"' && q !== "'" && q !== "`") continue;
    i++;

    let name = "";
    while (i < content.length && content[i] !== q) {
      if (content[i] === "\\") {
        i++;
        if (i < content.length) name += content[i];
      } else {
        name += content[i];
      }
      i++;
    }
    i++; // skip closing quote

    // ── Determine tier from name ────────────────────────────
    let tier: Tier;
    if (/\[ref:/.test(name))          tier = "ref";
    else if (/\[policy\]/.test(name)) tier = "policy";
    else                              tier = "structural";

    // ── Skip the rationale object for policyDescribe ────────
    if (keyword === "policyDescribe") {
      while (i < content.length && content[i] !== ",") i++;
      i++; // skip comma
      while (i < content.length && /\s/.test(content[i])) i++;

      if (i < content.length && content[i] === "{") {
        const afterRationale = skipBracedBlock(content, i);
        if (afterRationale === -1) continue;
        i = afterRationale;
      }
    }

    // ── Find callback's opening { ───────────────────────────
    const bracePos = content.indexOf("{", i);
    if (bracePos === -1) continue;
    if (bracePos - i > 500) continue;

    const bodyStart = bracePos + 1;
    const bodyEnd = findMatchingBrace(content, bodyStart);
    if (bodyEnd === -1) continue;

    describes.push({ tier, bodyStart, bodyEnd });
  }

  // ── 2. Find test/it calls ────────────────────────────────
  const testRe = /\b(test|it)(?:\.\w+)*\s*\(/g;
  const counts: TierCounts = { ref: 0, policy: 0, structural: 0, untagged: 0 };

  let tm: RegExpExecArray | null;
  while ((tm = testRe.exec(content)) !== null) {
    const pos = tm.index;
    const base = tm[1];

    // Skip matches inside comments
    if (isInsideComment(pos, commentRanges)) continue;

    // Guard: char after base word must not be alphanumeric (except '.')
    const afterBase = content[pos + base.length];
    if (afterBase && /\w/.test(afterBase) && afterBase !== ".") continue;

    // ── Find innermost enclosing describe ────────────────
    let innermost: DescribeBlock | null = null;
    for (const d of describes) {
      if (pos > d.bodyStart && pos < d.bodyEnd) {
        if (!innermost || d.bodyStart > innermost.bodyStart) {
          innermost = d;
        }
      }
    }

    counts[innermost ? innermost.tier : "untagged"]++;
  }

  return counts;
}

// ── File discovery (recursive walk) ────────────────────────────────────

function walkTestFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(d: string): void {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".test.ts") &&
        !SKIP_FILES.has(entry.name)
      ) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results.sort();
}

// ── Formatting helpers ─────────────────────────────────────────────────

function pad(v: string | number, w: number, right = true): string {
  const s = String(v);
  return right ? s.padStart(w) : s.padEnd(w);
}

function rowTotal(c: TierCounts): number {
  return c.ref + c.policy + c.structural + c.untagged;
}

// ── Main ───────────────────────────────────────────────────────────────

function main(): void {
  if (!fs.existsSync(TESTS_DIR)) {
    console.error(`Error: Tests directory not found: ${TESTS_DIR}`);
    process.exit(0);
  }

  const files = walkTestFiles(TESTS_DIR);
  if (files.length === 0) {
    console.log("No convention test files found.");
    process.exit(0);
  }

  // ── Aggregate by convention (subdirectory name) ───────────
  const groups = new Map<string, TierCounts>();

  for (const file of files) {
    const rel = path.relative(TESTS_DIR, file);
    const parts = rel.split(path.sep);
    const convention = parts.length > 1 ? parts[0] : "(root)";

    const content = fs.readFileSync(file, "utf-8");
    const fileCounts = parseFile(content);

    if (!groups.has(convention)) {
      groups.set(convention, { ref: 0, policy: 0, structural: 0, untagged: 0 });
    }
    const g = groups.get(convention)!;
    g.ref += fileCounts.ref;
    g.policy += fileCounts.policy;
    g.structural += fileCounts.structural;
    g.untagged += fileCounts.untagged;
  }

  // Sort: named conventions alphabetically, (root) last
  const sorted = [...groups.entries()].sort(([a], [b]) => {
    if (a === "(root)") return 1;
    if (b === "(root)") return -1;
    return a.localeCompare(b);
  });

  // ── Compute totals ────────────────────────────────────────
  const totals: TierCounts = { ref: 0, policy: 0, structural: 0, untagged: 0 };
  for (const [, c] of sorted) {
    totals.ref += c.ref;
    totals.policy += c.policy;
    totals.structural += c.structural;
    totals.untagged += c.untagged;
  }
  const grandTotal = rowTotal(totals);

  // ── Column widths ─────────────────────────────────────────
  const allConvNames = sorted.map(([n]) => n);
  const nW = Math.max("Convention".length, ...allConvNames.map((n) => n.length));

  const colW = (label: string, ...vals: number[]) =>
    Math.max(label.length, ...vals.map((v) => String(v).length));

  const rW = colW("ref",        totals.ref,        ...sorted.map(([, c]) => c.ref));
  const pW = colW("policy",     totals.policy,     ...sorted.map(([, c]) => c.policy));
  const sW = colW("structural", totals.structural, ...sorted.map(([, c]) => c.structural));
  const uW = colW("untagged",   totals.untagged,   ...sorted.map(([, c]) => c.untagged));
  const tW = colW("total",      grandTotal,        ...sorted.map(([, c]) => rowTotal(c)));

  const lineW = nW + 2 + rW + 2 + pW + 2 + sW + 2 + uW + 2 + tW;
  const sep = "\u2500".repeat(lineW);

  // ── Header ────────────────────────────────────────────────
  console.log();
  console.log(`${C.bold}Convention Test Tier Coverage${C.reset}`);
  console.log(sep);
  console.log(
    `${C.bold}${pad("Convention", nW, false)}${C.reset}  ` +
      `${C.dim}${pad("ref", rW)}  ` +
      `${pad("policy", pW)}  ` +
      `${pad("structural", sW)}  ` +
      `${pad("untagged", uW)}${C.reset}  ` +
      `${C.bold}${pad("total", tW)}${C.reset}`,
  );
  console.log(sep);

  // ── Data rows ─────────────────────────────────────────────
  for (const [name, c] of sorted) {
    const rt = rowTotal(c);
    const untaggedCell =
      c.untagged > 0
        ? `${C.yellow}${pad(c.untagged, uW)}${C.reset}`
        : `${pad(c.untagged, uW)}`;

    console.log(
      `${pad(name, nW, false)}  ` +
        `${pad(c.ref, rW)}  ` +
        `${pad(c.policy, pW)}  ` +
        `${pad(c.structural, sW)}  ` +
        `${untaggedCell}  ` +
        `${pad(rt, tW)}`,
    );
  }

  // ── Totals row ────────────────────────────────────────────
  console.log(sep);
  const totalUntaggedCell =
    totals.untagged > 0
      ? `${C.yellow}${pad(totals.untagged, uW)}${C.reset}`
      : `${pad(totals.untagged, uW)}`;

  console.log(
    `${C.bold}${pad("TOTAL", nW, false)}${C.reset}  ` +
      `${pad(totals.ref, rW)}  ` +
      `${pad(totals.policy, pW)}  ` +
      `${pad(totals.structural, sW)}  ` +
      `${totalUntaggedCell}  ` +
      `${C.bold}${pad(grandTotal, tW)}${C.reset}`,
  );

  // ── Health line ───────────────────────────────────────────
  console.log();
  if (totals.untagged > 0) {
    console.log(
      `${C.yellow}\u26A0  ${totals.untagged} untagged test(s) \u2014 add a [ref:source] or [policy] describe block${C.reset}`,
    );
  } else {
    console.log(`${C.green}\u2713  All tests tagged${C.reset}`);
  }
  console.log();
}

main();
process.exit(0);
