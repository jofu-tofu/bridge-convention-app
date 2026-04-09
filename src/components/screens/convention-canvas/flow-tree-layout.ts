import type { FlowTreeNode } from "../../../service/response-types";
import type { FlowChartEdge, FlowChartNode } from "./flow-chart-types";

export const NODE_W = 200;
export const NODE_H = 50;
export const SIBLING_GAP = 16;
export const DEPTH_GAP = 80;

interface SubtreeInfo {
  node: FlowTreeNode;
  width: number;
  children: SubtreeInfo[];
}

/** Compute subtree widths bottom-up. */
function measureSubtree(node: FlowTreeNode): SubtreeInfo {
  if (node.children.length === 0) {
    return { node, width: NODE_W, children: [] };
  }
  const children = node.children.map(measureSubtree);
  const totalWidth =
    children.reduce((sum, c) => sum + c.width, 0) +
    SIBLING_GAP * (children.length - 1);
  return { node, width: Math.max(NODE_W, totalWidth), children };
}

/** Assign x/y positions top-down. */
function assignPositions(
  info: SubtreeInfo,
  cx: number,
  y: number,
  parentId: string | null,
  depth: number,
  nodes: FlowChartNode[],
): void {
  nodes.push({
    id: info.node.id,
    flowNode: info.node,
    x: cx - NODE_W / 2,
    y,
    width: NODE_W,
    height: NODE_H,
    parentId,
    depth,
  });

  if (info.children.length === 0) return;

  const childY = y + NODE_H + DEPTH_GAP;
  const totalChildWidth =
    info.children.reduce((sum, c) => sum + c.width, 0) +
    SIBLING_GAP * (info.children.length - 1);
  let childX = cx - totalChildWidth / 2;

  for (const child of info.children) {
    const childCx = childX + child.width / 2;
    assignPositions(child, childCx, childY, info.node.id, depth + 1, nodes);
    childX += child.width + SIBLING_GAP;
  }
}

/** Generate cubic bezier edge paths. */
function generateEdges(nodes: FlowChartNode[]): FlowChartEdge[] {
  const edges: FlowChartEdge[] = [];
  for (const node of nodes) {
    if (!node.parentId) continue;
    const sx = node.x + NODE_W / 2;
    const sy = node.y;
    const parent = nodes.find((n) => n.id === node.parentId);
    if (!parent) continue;
    const px = parent.x + NODE_W / 2;
    const py = parent.y + NODE_H;
    const midY = (py + sy) / 2;
    edges.push({
      id: `edge-${node.parentId}-${node.id}`,
      sourceId: node.parentId,
      targetId: node.id,
      path: `M ${px} ${py} C ${px} ${midY}, ${sx} ${midY}, ${sx} ${sy}`,
    });
  }
  return edges;
}

/**
 * Layout a FlowTreeNode tree into positioned FlowChartNodes and FlowChartEdges.
 */
export function layoutFlowTree(root: FlowTreeNode): {
  nodes: FlowChartNode[];
  edges: FlowChartEdge[];
  totalWidth: number;
  totalHeight: number;
} {
  const measured = measureSubtree(root);
  const nodes: FlowChartNode[] = [];
  const startX = measured.width / 2;
  assignPositions(measured, startX, 0, null, 0, nodes);

  const edges = generateEdges(nodes);

  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }

  return { nodes, edges, totalWidth: maxX, totalHeight: maxY };
}
