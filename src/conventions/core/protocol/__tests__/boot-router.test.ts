import { describe, it, expect } from "vitest";
import { BidSuit } from "../../../../engine/types";
import type { Call } from "../../../../engine/types";
import type {
  BaseModuleSpec,
  EventPattern,
  FrameStateSpec,
  OpeningPatternSpec,
} from "../types";
import type { FactCatalogExtension } from "../../../../core/contracts/fact-catalog";
import {
  callToTrieKey,
  compileBootRouter,
  advanceBootRouter,
  getViableTracks,
} from "../boot-router";

// ── Test Helpers ────────────────────────────────────────────────────

/** Minimal fact catalog extension for test fixtures. */
const emptyFacts: FactCatalogExtension = {
  definitions: [],
  evaluators: new Map(),
};

/** Minimal frame state for test fixtures. */
function stubState(id: string): FrameStateSpec {
  return { id, eventTransitions: [] };
}

/** Shorthand for a bid Call. */
function bid(level: 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: BidSuit): Call {
  return { type: "bid", level, strain };
}

/** Shorthand for a pass Call. */
const pass: Call = { type: "pass" };

/** Shorthand for a double Call. */
const double: Call = { type: "double" };

/** Shorthand for a redouble Call. */
const redouble: Call = { type: "redouble" };

/** Shorthand to build a Call-based EventPattern. */
function callEvent(call: Call): EventPattern {
  return { call };
}

/** Build a minimal BaseModuleSpec for testing. */
function makeTrack(
  id: string,
  patterns: readonly OpeningPatternSpec[],
  opts?: { openingSurface?: string },
): BaseModuleSpec {
  return {
    role: "base" as const,
    id,
    name: id,
    openingPatterns: patterns,
    openingSurface: opts?.openingSurface,
    states: { init: stubState("init") },
    initialStateId: "init",
    facts: emptyFacts,
  };
}

/** Build an OpeningPatternSpec from calls with optional priority. */
function pattern(
  calls: readonly Call[],
  startState = "init",
  priority?: number,
): OpeningPatternSpec {
  return {
    prefix: calls.map(callEvent),
    startState,
    ...(priority !== undefined && { priority }),
  };
}

// ── callToTrieKey ───────────────────────────────────────────────────

describe("callToTrieKey", () => {
  it("converts a 1NT bid to '1NT'", () => {
    expect(callToTrieKey(bid(1, BidSuit.NoTrump))).toBe("1NT");
  });

  it("converts a 2C bid to '2C'", () => {
    expect(callToTrieKey(bid(2, BidSuit.Clubs))).toBe("2C");
  });

  it("converts a 7S bid to '7S'", () => {
    expect(callToTrieKey(bid(7 as 1, BidSuit.Spades))).toBe("7S");
  });

  it("converts pass to 'P'", () => {
    expect(callToTrieKey(pass)).toBe("P");
  });

  it("converts double to 'X'", () => {
    expect(callToTrieKey(double)).toBe("X");
  });

  it("converts redouble to 'XX'", () => {
    expect(callToTrieKey(redouble)).toBe("XX");
  });
});

// ── compileBootRouter ───────────────────────────────────────────────

describe("compileBootRouter", () => {
  it("compiles a single track with a single-event pattern", () => {
    const track = makeTrack("nt", [pattern([bid(1, BidSuit.NoTrump)])]);
    const router = compileBootRouter([track]);

    expect(router.rootNodeId).toBe("root");

    const root = router.nodes["root"];
    expect(root).toBeDefined();
    expect(root!.viableTrackIds).toContain("nt");
    expect(root!.children["1NT"]).toBeDefined();

    const leaf = router.nodes[root!.children["1NT"]!];
    expect(leaf).toBeDefined();
    expect(leaf!.selectedTrackId).toBe("nt");
    expect(leaf!.viableTrackIds).toContain("nt");
  });

  it("compiles multiple tracks with disjoint patterns", () => {
    const tracks = [
      makeTrack("nt", [pattern([bid(1, BidSuit.NoTrump)])]),
      makeTrack("hearts", [pattern([bid(1, BidSuit.Hearts)])]),
      makeTrack("weak2d", [pattern([bid(2, BidSuit.Diamonds)])]),
    ];
    const router = compileBootRouter(tracks);

    const root = router.nodes["root"]!;
    expect(root.viableTrackIds).toHaveLength(3);
    expect(root.viableTrackIds).toEqual(
      expect.arrayContaining(["nt", "hearts", "weak2d"]),
    );

    // Each pattern leads to its own selected track.
    const ntNode = router.nodes[root.children["1NT"]!]!;
    expect(ntNode.selectedTrackId).toBe("nt");

    const hNode = router.nodes[root.children["1H"]!]!;
    expect(hNode.selectedTrackId).toBe("hearts");

    const dNode = router.nodes[root.children["2D"]!]!;
    expect(dNode.selectedTrackId).toBe("weak2d");
  });

  it("compiles a multi-event prefix (1H → P → bergen track)", () => {
    const bergen = makeTrack("bergen", [
      pattern([bid(1, BidSuit.Hearts), pass]),
    ]);
    const router = compileBootRouter([bergen]);

    const root = router.nodes["root"]!;
    expect(root.viableTrackIds).toContain("bergen");

    const h1Node = router.nodes[root.children["1H"]!]!;
    expect(h1Node.selectedTrackId).toBeUndefined();
    expect(h1Node.viableTrackIds).toContain("bergen");

    const leafNode = router.nodes[h1Node.children["P"]!]!;
    expect(leafNode.selectedTrackId).toBe("bergen");
    expect(leafNode.viableTrackIds).toContain("bergen");
  });

  it("throws on ambiguous patterns with equal priority", () => {
    const trackA = makeTrack("a", [pattern([bid(1, BidSuit.NoTrump)])]);
    const trackB = makeTrack("b", [pattern([bid(1, BidSuit.NoTrump)])]);

    expect(() => compileBootRouter([trackA, trackB])).toThrow(
      /Ambiguous opening pattern/,
    );
  });

  it("resolves ambiguity by priority (lower wins)", () => {
    const trackA = makeTrack("a", [
      pattern([bid(1, BidSuit.NoTrump)], "init", 10),
    ]);
    const trackB = makeTrack("b", [
      pattern([bid(1, BidSuit.NoTrump)], "init", 1),
    ]);
    const router = compileBootRouter([trackA, trackB]);

    const root = router.nodes["root"]!;
    const leaf = router.nodes[root.children["1NT"]!]!;
    expect(leaf.selectedTrackId).toBe("b");
  });

  it("resolves when higher-priority track is inserted first", () => {
    const trackA = makeTrack("a", [
      pattern([bid(1, BidSuit.NoTrump)], "init", 1),
    ]);
    const trackB = makeTrack("b", [
      pattern([bid(1, BidSuit.NoTrump)], "init", 10),
    ]);
    const router = compileBootRouter([trackA, trackB]);

    const root = router.nodes["root"]!;
    const leaf = router.nodes[root.children["1NT"]!]!;
    expect(leaf.selectedTrackId).toBe("a");
  });

  it("allows the same track to have multiple distinct patterns", () => {
    const track = makeTrack("major", [
      pattern([bid(1, BidSuit.Hearts)]),
      pattern([bid(1, BidSuit.Spades)]),
    ]);
    const router = compileBootRouter([track]);

    const root = router.nodes["root"]!;
    const hLeaf = router.nodes[root.children["1H"]!]!;
    const sLeaf = router.nodes[root.children["1S"]!]!;
    expect(hLeaf.selectedTrackId).toBe("major");
    expect(sLeaf.selectedTrackId).toBe("major");
  });

  it("handles a track with no opening patterns (not viable at root)", () => {
    const empty = makeTrack("empty", []);
    const nt = makeTrack("nt", [pattern([bid(1, BidSuit.NoTrump)])]);
    const router = compileBootRouter([empty, nt]);

    const root = router.nodes["root"]!;
    expect(root.viableTrackIds).not.toContain("empty");
    expect(root.viableTrackIds).toContain("nt");
  });

  it("propagates openingSurface to viableSurfaces", () => {
    const track = makeTrack("nt", [pattern([bid(1, BidSuit.NoTrump)])], {
      openingSurface: "nt-opening-surface",
    });
    const router = compileBootRouter([track]);

    const root = router.nodes["root"]!;
    expect(root.viableSurfaces).toContain("nt-opening-surface");

    const leaf = router.nodes[root.children["1NT"]!]!;
    expect(leaf.viableSurfaces).toContain("nt-opening-surface");
  });

  it("supports callType-based event patterns", () => {
    const track = makeTrack("passout", [
      {
        prefix: [
          { call: bid(1, BidSuit.NoTrump) },
          { callType: "pass" },
        ],
        startState: "init",
      },
    ]);
    const router = compileBootRouter([track]);

    const root = router.nodes["root"]!;
    const ntNode = router.nodes[root.children["1NT"]!]!;
    const leaf = router.nodes[ntNode.children["P"]!]!;
    expect(leaf.selectedTrackId).toBe("passout");
  });
});

// ── advanceBootRouter ───────────────────────────────────────────────

describe("advanceBootRouter", () => {
  const tracks = [
    makeTrack("nt", [pattern([bid(1, BidSuit.NoTrump)])]),
    makeTrack("bergen", [pattern([bid(1, BidSuit.Hearts), pass])]),
  ];
  const router = compileBootRouter(tracks);

  it("advances to a child node on matching call", () => {
    const result = advanceBootRouter(
      router,
      router.rootNodeId,
      bid(1, BidSuit.NoTrump),
    );
    expect(result.nodeId).toBe("root/1NT");
    expect(result.selectedTrackId).toBe("nt");
  });

  it("stays at current node when call has no matching child", () => {
    const result = advanceBootRouter(
      router,
      router.rootNodeId,
      bid(3, BidSuit.Clubs),
    );
    expect(result.nodeId).toBe("root");
    expect(result.selectedTrackId).toBeUndefined();
  });

  it("walks a multi-step path correctly", () => {
    const step1 = advanceBootRouter(
      router,
      router.rootNodeId,
      bid(1, BidSuit.Hearts),
    );
    expect(step1.nodeId).toBe("root/1H");
    expect(step1.selectedTrackId).toBeUndefined();

    const step2 = advanceBootRouter(router, step1.nodeId, pass);
    expect(step2.nodeId).toBe("root/1H/P");
    expect(step2.selectedTrackId).toBe("bergen");
  });

  it("stays at current node when nodeId is unknown", () => {
    const result = advanceBootRouter(router, "nonexistent", pass);
    expect(result.nodeId).toBe("nonexistent");
    expect(result.selectedTrackId).toBeUndefined();
  });

  it("stays at leaf node when advancing past the end", () => {
    const step1 = advanceBootRouter(
      router,
      router.rootNodeId,
      bid(1, BidSuit.NoTrump),
    );
    // Already at selected leaf — no children for pass.
    const step2 = advanceBootRouter(router, step1.nodeId, pass);
    expect(step2.nodeId).toBe(step1.nodeId);
  });
});

// ── getViableTracks ─────────────────────────────────────────────────

describe("getViableTracks", () => {
  const tracks = [
    makeTrack("nt", [pattern([bid(1, BidSuit.NoTrump)])]),
    makeTrack("bergen", [pattern([bid(1, BidSuit.Hearts), pass])]),
  ];
  const router = compileBootRouter(tracks);

  it("returns all tracks at root", () => {
    const viable = getViableTracks(router, router.rootNodeId);
    expect(viable).toHaveLength(2);
    expect(viable).toEqual(expect.arrayContaining(["nt", "bergen"]));
  });

  it("returns only the matching track at a leaf", () => {
    const viable = getViableTracks(router, "root/1NT");
    expect(viable).toEqual(["nt"]);
  });

  it("narrows viable set at intermediate nodes", () => {
    const viable = getViableTracks(router, "root/1H");
    expect(viable).toEqual(["bergen"]);
  });

  it("returns empty array for unknown nodeId", () => {
    const viable = getViableTracks(router, "nonexistent");
    expect(viable).toEqual([]);
  });
});
