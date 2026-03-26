/**
 * Layout algorithm for the conversation flow tree SVG.
 *
 * Horizontal tree: root on the left, branches to the right.
 * Pure functions — no Svelte or DOM dependencies.
 */

import type { FlowTreeNode } from "../../service";

// ── Layout constants ─────────────────────────────────────────────────

const NODE_WIDTH = 120;
const NODE_HEIGHT = 36;
const H_GAP = 160;
const V_GAP = 8;

export interface NodePosition {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Compute the vertical space needed for a subtree (number of leaf-equivalent slots). */
function subtreeSlots(node: FlowTreeNode): number {
  if (node.children.length === 0) return 1;
  let total = 0;
  for (const child of node.children) {
    total += subtreeSlots(child);
  }
  return total;
}

/** Recursively lay out nodes. Returns a position map. */
function layoutRecursive(
  node: FlowTreeNode,
  x: number,
  yStart: number,
  positions: Map<string, NodePosition>,
): number {
  const slots = subtreeSlots(node);
  const totalHeight = slots * NODE_HEIGHT + (slots - 1) * V_GAP;
  const y = yStart + totalHeight / 2 - NODE_HEIGHT / 2;

  positions.set(node.id, { x, y, width: NODE_WIDTH, height: NODE_HEIGHT });

  if (node.children.length > 0) {
    const childX = x + H_GAP;
    let childY = yStart;
    for (const child of node.children) {
      const childSlots = subtreeSlots(child);
      const childTotalHeight = childSlots * NODE_HEIGHT + (childSlots - 1) * V_GAP;
      layoutRecursive(child, childX, childY, positions);
      childY += childTotalHeight + V_GAP;
    }
  }

  return totalHeight;
}

/** Compute positions for all nodes in the tree. */
export function layoutTree(root: FlowTreeNode): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  layoutRecursive(root, 0, 0, positions);
  return positions;
}

/** Compute SVG dimensions from position extremes + padding. */
export function computeSvgDimensions(positions: Map<string, NodePosition>): {
  width: number;
  height: number;
} {
  let maxX = 0;
  let maxY = 0;
  for (const pos of positions.values()) {
    maxX = Math.max(maxX, pos.x + pos.width);
    maxY = Math.max(maxY, pos.y + pos.height);
  }
  return { width: maxX + 20, height: maxY + 20 };
}

/** Build an SVG cubic Bezier path from parent to child node. */
export function buildEdgePath(
  parent: NodePosition,
  child: NodePosition,
): string {
  const x1 = parent.x + parent.width;
  const y1 = parent.y + parent.height / 2;
  const x2 = child.x;
  const y2 = child.y + child.height / 2;
  const cx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
}

/** Collect all edges as [parentId, childId] pairs. */
export function collectEdges(node: FlowTreeNode): Array<[string, string]> {
  const edges: Array<[string, string]> = [];
  for (const child of node.children) {
    edges.push([node.id, child.id]);
    edges.push(...collectEdges(child));
  }
  return edges;
}

/** Flatten a tree into a list of all nodes. */
export function flattenNodes(node: FlowTreeNode): FlowTreeNode[] {
  const result: FlowTreeNode[] = [node];
  for (const child of node.children) {
    result.push(...flattenNodes(child));
  }
  return result;
}

/** Assign a distinct color index per moduleId. */
export function buildModuleColorMap(node: FlowTreeNode): Map<string, number> {
  const moduleIds = new Set<string>();
  for (const n of flattenNodes(node)) {
    if (n.moduleId) moduleIds.add(n.moduleId);
  }
  const map = new Map<string, number>();
  let i = 0;
  for (const id of moduleIds) {
    map.set(id, i++);
  }
  return map;
}

/** Module color palette — small set of distinguishable colors for dark backgrounds. */
export const MODULE_COLORS = [
  "var(--color-accent-primary)",   // blue
  "var(--color-accent-success)",   // green
  "var(--color-suit-hearts)",      // red/pink
  "var(--color-suit-diamonds)",    // orange
  "#a78bfa",                       // purple
  "#67e8f9",                       // cyan
] as const;
