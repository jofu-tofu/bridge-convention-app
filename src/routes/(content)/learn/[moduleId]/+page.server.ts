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
  reference: ReferenceView;
  phases: PhaseGroupView[];
  bundleIds: string[];
}

interface ReferenceView {
  summaryCard: SummaryCard;
  whenToUse: { predicate: unknown; gloss: string }[];
  whenNotToUse: WhenNotItem[];
  responseTable: ResponseTable;
  workedAuctions: WorkedAuction[];
  interference: Interference;
  quickReference: QuickReference;
  relatedLinks: RelatedLink[];
}

interface SummaryCardPeer {
  meaningId: string;
  call: Call;
  callDisplay: string;
  promises: string;
  denies: string;
  discriminatorLabel: string;
}

interface SummaryCardStyleVariant {
  name: string;
  description: string;
}

interface SummaryCard {
  trigger: string;
  bid: Call;
  promises: string;
  denies: string;
  guidingIdea: string;
  agreementNote: string;
  styleVariants?: SummaryCardStyleVariant[];
  peers?: SummaryCardPeer[];
}

interface WhenNotItem {
  text: string;
  reason: string;
}

interface ResponseTable {
  columns: { id: string; label: string }[];
  rows: ResponseTableRow[];
}

interface ResponseTableRow {
  meaningId: string;
  response: Call;
  meaning: string;
  cells: { columnId: string; columnLabel: string; text: string }[];
}

interface WorkedAuction {
  kind: "positive" | "negative";
  label: string;
  calls: WorkedAuctionCall[];
  responderHand?: HandSample | null;
}

interface WorkedAuctionCall {
  seat: string;
  call: Call;
  rationale: string;
}

interface HandSample {
  spades: string;
  hearts: string;
  diamonds: string;
  clubs: string;
}

interface InterferenceItem {
  opponentAction: string;
  ourAction: string;
  note: string;
}

type Interference =
  | { status: "applicable"; items: InterferenceItem[] }
  | { status: "notApplicable"; reason: string };

interface ResolvedAxis {
  label: string;
  values: string[];
}

interface ResolvedCell {
  call: string;
  gloss?: string;
  kind: "action" | "notApplicable" | "empty";
}

type QuickReference =
  | {
      kind: "grid";
      rowAxis: ResolvedAxis;
      colAxis: ResolvedAxis;
      cells: ResolvedCell[][];
    }
  | {
      kind: "list";
      axis: ResolvedAxis;
      items: { recommendation: string; note: string }[];
    };

interface RelatedLink {
  moduleId: string;
  discriminator: string;
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
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7;
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
  call: Call | null;
  callDisplay: string | null;
  turn: "opener" | "responder" | null;
  label: string;
  moduleId: string | null;
  moduleDisplayName: string | null;
  meaningId: string | null;
  children: FlowTreeNode[];
  depth: number;
  recommendation: "must" | "should" | "may" | "avoid" | null;
  disclosure: "alert" | "announcement" | "natural" | "standard" | null;
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
