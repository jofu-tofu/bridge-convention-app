// ── Boot Router: Compiled Opening Pattern Trie ──────────────────────
//
// Merges base track opening patterns into a prefix trie for efficient
// track selection during the opening phase of a conversation.

import type { Call } from "../../../engine/types";
import type {
  BaseModuleSpec,
  BootRouter,
  BootTrieNode,
  EventPattern,
} from "./types";

// ── Public API ──────────────────────────────────────────────────────

/** Converts a Call to a trie key string for lookup. */
export function callToTrieKey(call: Call): string {
  if (call.type === "bid") {
    return `${call.level}${call.strain}`;
  }
  switch (call.type) {
    case "pass":
      return "P";
    case "double":
      return "X";
    case "redouble":
      return "XX";
  }
}

/**
 * Compiles an array of base tracks into a BootRouter prefix trie.
 *
 * Each track's opening patterns are inserted into the trie. When a
 * prefix uniquely determines a track, the leaf node records
 * `selectedTrackId`. Ambiguous prefixes are resolved by priority
 * (lower number wins); equal priority on the same prefix throws a
 * composition error.
 */
export function compileBootRouter(
  tracks: readonly BaseModuleSpec[],
): BootRouter {
  // Build a mutable trie, then freeze into BootRouter.
  const mutableNodes = new Map<string, MutableNode>();
  const rootId = "root";
  const root = makeMutableNode(rootId);
  mutableNodes.set(rootId, root);

  for (const track of tracks) {
    for (const pattern of track.openingPatterns) {
      const priority = pattern.priority ?? 0;
      let current = root;

      // Walk / create the path for this pattern's prefix.
      for (const event of pattern.prefix) {
        const key = eventPatternToTrieKey(event);
        const existingChildId = current.children.get(key);
        let child: MutableNode;

        if (existingChildId) {
          child = mutableNodes.get(existingChildId)!;
        } else {
          const childId = `${current.nodeId}/${key}`;
          child = makeMutableNode(childId);
          current.children.set(key, childId);
          mutableNodes.set(childId, child);
        }

        child.viableTrackIds.add(track.id);
        if (track.openingSurface) {
          child.viableSurfaces.add(track.openingSurface);
        }

        current = child;
      }

      // Mark selection at the leaf (end of prefix).
      resolveSelection(current, track.id, priority);
    }

    // Track is viable at root if it contributes any opening patterns.
    if (track.openingPatterns.length > 0) {
      root.viableTrackIds.add(track.id);
      if (track.openingSurface) {
        root.viableSurfaces.add(track.openingSurface);
      }
    }
  }

  // Freeze into BootRouter.
  const nodes: Record<string, BootTrieNode> = {};
  mutableNodes.forEach((mNode, id) => {
    nodes[id] = freezeNode(mNode);
  });

  return { rootNodeId: rootId, nodes };
}

/**
 * Advances the boot router by one call event.
 *
 * Returns the new node ID and, if the new node selects a track,
 * its `selectedTrackId`. If the call does not match any child,
 * the router stays at the current node.
 */
export function advanceBootRouter(
  router: BootRouter,
  currentNodeId: string,
  call: Call,
): { readonly nodeId: string; readonly selectedTrackId?: string } {
  const currentNode = router.nodes[currentNodeId];
  if (!currentNode) {
    return { nodeId: currentNodeId };
  }

  const key = callToTrieKey(call);
  const childNodeId = currentNode.children[key];

  if (childNodeId === undefined) {
    // No matching child — stay at current node.
    return { nodeId: currentNodeId };
  }

  const childNode = router.nodes[childNodeId];
  if (!childNode) {
    return { nodeId: currentNodeId };
  }

  return {
    nodeId: childNode.nodeId,
    ...(childNode.selectedTrackId !== undefined && {
      selectedTrackId: childNode.selectedTrackId,
    }),
  };
}

/**
 * Returns which base track IDs are still viable at a given node.
 */
export function getViableTracks(
  router: BootRouter,
  nodeId: string,
): readonly string[] {
  const node = router.nodes[nodeId];
  if (!node) return [];
  return node.viableTrackIds;
}

// ── Internal Helpers ────────────────────────────────────────────────

interface MutableNode {
  readonly nodeId: string;
  readonly children: Map<string, string>; // key → child nodeId
  selectedTrackId?: string;
  selectedPriority?: number;
  readonly viableTrackIds: Set<string>;
  readonly viableSurfaces: Set<string>;
}

function makeMutableNode(nodeId: string): MutableNode {
  return {
    nodeId,
    children: new Map(),
    viableTrackIds: new Set(),
    viableSurfaces: new Set(),
  };
}

/** Converts an EventPattern to a trie key for insertion. */
function eventPatternToTrieKey(pattern: EventPattern): string {
  if (pattern.call) {
    return callToTrieKey(pattern.call);
  }
  if (pattern.callType) {
    switch (pattern.callType) {
      case "pass":
        return "P";
      case "double":
        return "X";
      case "redouble":
        return "XX";
      case "bid":
        throw new Error(
          "Cannot use callType 'bid' as a trie key — it matches all bid levels/strains",
        );
    }
  }
  throw new Error(
    "EventPattern must specify 'call' or 'callType' to produce a trie key",
  );
}

/**
 * Resolves track selection at a trie leaf.
 * Lower priority number wins. Equal priority on different tracks throws.
 */
function resolveSelection(
  node: MutableNode,
  trackId: string,
  priority: number,
): void {
  if (node.selectedTrackId === undefined) {
    node.selectedTrackId = trackId;
    node.selectedPriority = priority;
    return;
  }

  // Same track, different patterns converging — no conflict.
  if (node.selectedTrackId === trackId) {
    if (priority < (node.selectedPriority ?? 0)) {
      node.selectedPriority = priority;
    }
    return;
  }

  // Different tracks at same node — resolve by priority.
  const existing = node.selectedPriority ?? 0;
  if (priority === existing) {
    throw new Error(
      `Ambiguous opening pattern: tracks "${node.selectedTrackId}" and "${trackId}" ` +
        `match the same prefix with equal priority ${priority}`,
    );
  }
  if (priority < existing) {
    node.selectedTrackId = trackId;
    node.selectedPriority = priority;
  }
}

/** Converts a MutableNode to the frozen BootTrieNode shape. */
function freezeNode(node: MutableNode): BootTrieNode {
  const children: Record<string, string> = {};
  node.children.forEach((childId, key) => {
    children[key] = childId;
  });

  return {
    nodeId: node.nodeId,
    children,
    viableTrackIds: Array.from(node.viableTrackIds),
    ...(node.selectedTrackId !== undefined && {
      selectedTrackId: node.selectedTrackId,
    }),
    ...(node.viableSurfaces.size > 0 && {
      viableSurfaces: Array.from(node.viableSurfaces),
    }),
  };
}
