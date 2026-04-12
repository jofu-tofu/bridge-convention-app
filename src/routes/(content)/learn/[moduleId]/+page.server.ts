import fs from "node:fs";
import path from "node:path";
import { error } from "@sveltejs/kit";

interface StaticLearnData {
  modules: ModuleCatalogEntry[];
  viewports: Record<
    string,
    { learning: ModuleLearningViewport; flowTree: ModuleFlowTreeViewport | null }
  >;
}

interface ModuleCatalogEntry {
  moduleId: string;
  displayName: string;
  description: string;
  purpose: string;
  surfaceCount: number;
  bundleIds: string[];
}

interface ModuleLearningViewport {
  moduleId: string;
  displayName: string;
  description: string;
  purpose: string;
  teaching: {
    tradeoff: string | null;
    principle: string | null;
    commonMistakes: string[];
  };
  phases: PhaseGroupView[];
  bundleIds: string[];
}

interface PhaseGroupView {
  phase: string;
  phaseDisplay: string;
  turn: string | null;
  transitionLabel: string | null;
  surfaces: SurfaceDetailView[];
}

interface SurfaceDetailView {
  meaningId: string;
  teachingLabel: { name: string; summary: string };
  callDisplay: string;
  disclosure: string;
  recommendation: string | null;
  explanationText: string | null;
  clauses: SurfaceClauseView[];
}

interface SurfaceClauseView {
  factId: string;
  operator: string;
  description: string;
  isPublic: boolean;
}

interface ModuleFlowTreeViewport {
  moduleId: string;
  moduleName: string;
  root: FlowTreeNode;
  nodeCount: number;
  maxDepth: number;
}

interface FlowTreeNode {
  id: string;
  callDisplay: string | null;
  turn: string | null;
  label: string;
  moduleId: string | null;
  meaningId: string | null;
  children: FlowTreeNode[];
  depth: number;
  recommendation: string | null;
  disclosure: string | null;
  explanationText: string | null;
  clauses: SurfaceClauseView[];
}

// Try multiple locations for the generated learn data
function loadLearnData(): StaticLearnData | null {
  const candidates = [
    path.resolve(".generated/learn-data.json"),
    path.resolve("dist/.generated/learn-data.json"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf-8")) as StaticLearnData;
    }
  }
  return null;
}

export function load({ params }: { params: { moduleId: string } }) {
  const data = loadLearnData();
  if (!data) error(404, "Learn data not available");

  const vp = data.viewports[params.moduleId];
  if (!vp) error(404, "Module not found");

  const otherModules = data.modules
    .filter((m) => m.moduleId !== params.moduleId)
    .map((m) => ({
      moduleId: m.moduleId,
      displayName: m.displayName,
      description: m.description,
    }));

  return {
    viewport: vp.learning,
    flowTree: vp.flowTree,
    otherModules,
  };
}

export function entries() {
  const data = loadLearnData();
  if (!data) return [];
  return data.modules.map((m) => ({ moduleId: m.moduleId }));
}
