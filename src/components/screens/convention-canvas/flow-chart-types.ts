import type { FlowTreeNode } from "../../../service/response-types";

export interface FlowChartNode {
  id: string;
  flowNode: FlowTreeNode;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId: string | null;
  depth: number;
}

export interface FlowChartEdge {
  id: string;
  sourceId: string;
  targetId: string;
  path: string;
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}
