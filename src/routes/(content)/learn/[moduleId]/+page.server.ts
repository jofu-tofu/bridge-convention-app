import fs from "node:fs";
import path from "node:path";
import { error } from "@sveltejs/kit";

interface StaticLearnData {
  modules: ModuleCatalogEntry[];
  viewports: Record<
    string,
    {
      learning: ModuleLearningViewport;
      flowTree: ModuleFlowTreeViewport | null;
    }
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
  reference: ReferenceView | null;
  phases: PhaseGroupView[];
  bundleIds: string[];
}

interface ReferenceView {
  summaryCard: SummaryCard;
  whenToUse: string[];
  whenNotToUse: WhenNotItem[];
  responseTableRows: ResponseTableRow[];
  workedAuctions: WorkedAuction[];
  interference: InterferenceItem[];
  decisionGrid: DecisionGrid | null;
  systemCompat: SystemCompat;
  relatedLinks: RelatedLink[];
  responseTableOverrides: Record<string, ResponseTableOverride>;
}

interface SummaryCard {
  trigger: string;
  bid: Call;
  promises: string;
  denies: string;
  guidingIdea: string;
  partnership: string;
}

interface WhenNotItem {
  text: string;
  reason: string;
}

interface ResponseTableRow {
  meaningId: string;
  response: Call;
  meaning: string;
  shape: string;
  hcp: string;
  forcing: string;
}

interface WorkedAuction {
  label: string;
  calls: WorkedAuctionCall[];
  outcomeNote: string;
}

interface WorkedAuctionCall {
  seat: string;
  call: Call;
  rationale: string;
}

interface InterferenceItem {
  opponentAction: string;
  ourAction: string;
  note: string;
}

interface DecisionGrid {
  rows: string[];
  cols: string[];
  cells: string[][];
}

interface SystemCompat {
  sayc: string;
  twoOverOne: string;
  acol: string;
  customNote: string;
}

interface RelatedLink {
  moduleId: string;
  discriminator: string;
}

interface ResponseTableOverride {
  shape?: string;
  hcp?: string;
  forcing?: string;
}

type Call = PassCall | DoubleCall | RedoubleCall | BidCall;

interface PassCall {
  type: "pass";
}

interface DoubleCall {
  type: "double";
}

interface RedoubleCall {
  type: "redouble";
}

interface BidCall {
  type: "bid";
  level: number;
  strain: "C" | "D" | "H" | "S" | "NT";
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
