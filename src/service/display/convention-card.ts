import type { SystemConfig, BaseSystemId } from "../session-types";
import {
  ConventionCardSectionId,
} from "../response-types";
import { listModules, listConventions, buildBaseModuleInfos, getModuleLearningViewportSync } from "../service-helpers";
import { formatRuleName } from "./format";

// ── Convention catalog functions (delegating to Rust/WASM) ──────────

interface ModuleInfo {
  readonly moduleId: string;
  readonly description: string;
  readonly teaching: { readonly principle?: string; readonly tradeoff?: string; readonly commonMistakes: readonly string[] };
}

function getModule(moduleId: string, _sys: SystemConfig): ModuleInfo | undefined {
  try {
    const catalog = listModules();
    const entry = catalog.find(m => m.moduleId === moduleId);
    if (!entry) return undefined;
    const viewport = getModuleLearningViewportSync(moduleId);
    return {
      moduleId: entry.moduleId,
      description: entry.description,
      teaching: {
        principle: viewport?.teaching.principle ?? undefined,
        tradeoff: viewport?.teaching.tradeoff ?? undefined,
        commonMistakes: viewport?.teaching.commonMistakes ?? [],
      },
    };
  } catch {
    return undefined;
  }
}

function getBaseModuleIds(systemId: BaseSystemId): readonly string[] {
  try {
    return buildBaseModuleInfos(systemId).map(m => m.id);
  } catch {
    return [];
  }
}

function getBundleInput(id: string): { memberIds: readonly string[] } | undefined {
  try {
    const all = listConventions();
    const bundle = all.find(c => c.id === id);
    if (!bundle) return undefined;
    return { memberIds: bundle.moduleIds ?? [] };
  } catch {
    return undefined;
  }
}
import type {
  ConventionCardView,
  ConventionCardPanelView,
  ConventionCardSection,
  ConventionCardLineItem,
  ConventionCardModuleDetail,
  AcblCardPanelView,
  AcblCardSection,
} from "../response-types";

// ── Shared helpers ─────────────────────────────────────────────

/** Short system label for UI display. */
function systemShortLabel(config: SystemConfig): string {
  switch (config.systemId) {
    case "sayc": return "SAYC";
    case "two-over-one": return "2/1";
    case "acol": return "Acol";
  }
}

/** Format forcing duration for display. */
function formatForcingDuration(duration: "one-round" | "game"): string {
  return duration === "game" ? "Game forcing" : "1 round";
}

/** Format 1NT response for display. */
function formatOneNtResponse(config: SystemConfig): string {
  const { forcing, minHcp, maxHcp } = config.oneNtResponseAfterMajor;
  const status = forcing === "non-forcing" ? "Non-forcing"
    : forcing === "semi-forcing" ? "Semi-forcing"
    : "Forcing";
  return `${status} ${minHcp}\u2013${maxHcp}`;
}

// ── Old convention card (flat summary) ─────────────────────────

/** Build a convention card summary from system config. */
export function buildConventionCard(
  systemConfig: SystemConfig,
  partnership: string,
): ConventionCardView {
  return {
    partnership,
    systemName: systemShortLabel(systemConfig),
    ntRange: `${systemConfig.ntOpening.minHcp}\u2013${systemConfig.ntOpening.maxHcp}`,
    twoLevelForcing: formatForcingDuration(systemConfig.suitResponse.twoLevelForcingDuration),
    oneNtResponse: formatOneNtResponse(systemConfig),
    majorLength: `${systemConfig.openingRequirements.majorSuitMinLength}-card majors`,
  };
}

// ── Convention card panel (structured sections) ────────────────


/** Section definition for the convention card panel. */
interface SectionDef {
  readonly id: ConventionCardSectionId;
  readonly title: string;
  readonly moduleIds: readonly string[];
  readonly buildItems: (sys: SystemConfig) => readonly ConventionCardLineItem[];
}

const SECTION_DEFS: readonly SectionDef[] = [
  {
    id: ConventionCardSectionId.General,
    title: "General",
    moduleIds: [],
    buildItems: (sys) => [
      { label: "System", value: systemShortLabel(sys) },
      { label: "Majors", value: `${sys.openingRequirements.majorSuitMinLength}-card majors` },
    ],
  },
  {
    id: ConventionCardSectionId.NotrumpOpening,
    title: "1NT Opening & Responses",
    moduleIds: ["stayman", "jacoby-transfers", "smolen"],
    buildItems: (sys) => [
      { label: "1NT Range", value: `${sys.ntOpening.minHcp}\u2013${sys.ntOpening.maxHcp}` },
      { label: "Invite Range", value: `${sys.responderThresholds.inviteMin}\u2013${sys.responderThresholds.inviteMax} HCP` },
      { label: "Game Forcing", value: `${sys.responderThresholds.gameMin}+ HCP` },
      { label: "Slam Zone", value: `${sys.responderThresholds.slamMin}+ HCP` },
    ],
  },
  {
    id: ConventionCardSectionId.MajorOpening,
    title: "Major Openings",
    moduleIds: ["bergen"],
    buildItems: (sys) => [
      { label: "Length", value: `${sys.openingRequirements.majorSuitMinLength}+ cards` },
      { label: "New Suit at 2-Level", value: `${sys.suitResponse.twoLevelMin}+ HCP, ${formatForcingDuration(sys.suitResponse.twoLevelForcingDuration)}` },
      { label: "1NT Response", value: formatOneNtResponse(sys) },
    ],
  },
  {
    id: ConventionCardSectionId.MinorOpening,
    title: "Minor Openings",
    moduleIds: [],
    buildItems: () => [
      { label: "Style", value: "Standard" },
    ],
  },
  {
    id: ConventionCardSectionId.TwoLevelOpening,
    title: "2-Level Openings",
    moduleIds: ["weak-twos"],
    buildItems: () => [],
  },
  {
    id: ConventionCardSectionId.Competitive,
    title: "Competitive",
    moduleIds: ["dont"],
    buildItems: (sys) => [
      { label: "Redouble", value: `${sys.interference.redoubleMin}+ HCP` },
      { label: "vs 1NT", value: `DONT ${sys.dontOvercall.minHcp}\u2013${sys.dontOvercall.maxHcp} HCP` },
    ],
  },
  {
    id: ConventionCardSectionId.Slam,
    title: "Slam Conventions",
    moduleIds: ["blackwood"],
    buildItems: (sys) => [
      { label: "Slam Zone", value: `${sys.responderThresholds.slamMin}+ HCP` },
    ],
  },
];

function buildModuleDetail(moduleId: string, sys: SystemConfig): ConventionCardModuleDetail | undefined {
  const mod = getModule(moduleId, sys);
  if (!mod) return undefined;
  return {
    moduleId: mod.moduleId,
    moduleName: formatRuleName(mod.moduleId),
    description: mod.description,
    principle: mod.teaching.principle || undefined,
    tradeoff: mod.teaching.tradeoff || undefined,
    commonMistakes: mod.teaching.commonMistakes.length > 0
      ? mod.teaching.commonMistakes.map((m) => String(m))
      : undefined,
  };
}

/** Build a full convention card panel view with structured sections. */
export function buildConventionCardPanel(
  systemConfig: SystemConfig,
  conventionId?: string,
): ConventionCardPanelView {
  // Collect active module IDs from base system + optional bundle
  const activeModuleIds = new Set<string>([
    ...getBaseModuleIds(systemConfig.systemId),
    ...(conventionId ? (getBundleInput(conventionId)?.memberIds ?? []) : []),
  ]);

  const sections: ConventionCardSection[] = [];

  for (const def of SECTION_DEFS) {
    const items = def.buildItems(systemConfig);
    const modules: ConventionCardModuleDetail[] = [];

    for (const mid of def.moduleIds) {
      if (!activeModuleIds.has(mid)) continue;
      const detail = buildModuleDetail(mid, systemConfig);
      if (detail) modules.push(detail);
    }

    // Omit empty sections
    if (items.length === 0 && modules.length === 0) continue;

    const summaryParts = [
      ...items.map((i) => i.value),
      ...modules.map((m) => m.moduleName),
    ];

    sections.push({
      id: def.id,
      title: def.title,
      compactSummary: summaryParts.join(" \u00b7 "),
      items,
      modules,
    });
  }

  return {
    partnership: "N-S",
    systemName: systemShortLabel(systemConfig),
    sections,
  };
}

// ── ACBL convention card (11 standard sections) ──────────────

interface AcblSectionDef {
  readonly id: string;
  readonly title: string;
  readonly moduleIds: readonly string[];
  readonly alwaysAvailable: boolean;
  readonly buildItems: (sys: SystemConfig, activeModuleIds: ReadonlySet<string>) => readonly ConventionCardLineItem[];
}

const ACBL_SECTION_DEFS: readonly AcblSectionDef[] = [
  {
    id: "acbl-special-doubles",
    title: "Special Doubles",
    moduleIds: [],
    alwaysAvailable: true,
    buildItems: (sys) => [
      { label: "Negative", value: "Through 2\u2660" },
      { label: "Redouble", value: `${sys.interference.redoubleMin}+ HCP` },
    ],
  },
  {
    id: "acbl-notrump-opening",
    title: "Notrump Opening Bids",
    moduleIds: ["stayman", "jacoby-transfers", "smolen"],
    alwaysAvailable: true,
    buildItems: (sys) => [
      { label: "1NT Range", value: `${sys.ntOpening.minHcp}\u2013${sys.ntOpening.maxHcp}` },
      { label: "Invite Range", value: `${sys.responderThresholds.inviteMin}\u2013${sys.responderThresholds.inviteMax} HCP` },
      { label: "Game Forcing", value: `${sys.responderThresholds.gameMin}+ HCP` },
      { label: "Slam Zone", value: `${sys.responderThresholds.slamMin}+ HCP` },
    ],
  },
  {
    id: "acbl-major-opening",
    title: "Major Opening",
    moduleIds: ["bergen"],
    alwaysAvailable: true,
    buildItems: (sys) => [
      { label: "Min Length", value: `${sys.openingRequirements.majorSuitMinLength}+ cards` },
      { label: "1NT Response", value: formatOneNtResponse(sys) },
      { label: "New Suit at 2-Level", value: `${sys.suitResponse.twoLevelMin}+ HCP, ${formatForcingDuration(sys.suitResponse.twoLevelForcingDuration)}` },
    ],
  },
  {
    id: "acbl-minor-opening",
    title: "Minor Opening",
    moduleIds: [],
    alwaysAvailable: true,
    buildItems: () => [
      { label: "Style", value: "Standard" },
    ],
  },
  {
    id: "acbl-two-level-openings",
    title: "2-Level Openings",
    moduleIds: ["weak-twos"],
    alwaysAvailable: false,
    buildItems: () => [],
  },
  {
    id: "acbl-other-conventional",
    title: "Other Conventional Calls",
    moduleIds: [],
    alwaysAvailable: false,
    buildItems: () => [],
  },
  {
    id: "acbl-defensive-competitive",
    title: "Defensive & Competitive",
    moduleIds: ["dont"],
    alwaysAvailable: true,
    buildItems: (sys, activeModuleIds) => [
      {
        label: "vs 1NT",
        value: activeModuleIds.has("dont")
          ? `DONT ${sys.dontOvercall.minHcp}\u2013${sys.dontOvercall.maxHcp} HCP`
          : "Natural",
      },
      { label: "Redouble", value: `${sys.interference.redoubleMin}+ HCP` },
    ],
  },
  {
    id: "acbl-leads",
    title: "Leads",
    moduleIds: [],
    alwaysAvailable: false,
    buildItems: () => [],
  },
  {
    id: "acbl-signals",
    title: "Signals",
    moduleIds: [],
    alwaysAvailable: false,
    buildItems: () => [],
  },
  {
    id: "acbl-slam-conventions",
    title: "Slam Conventions",
    moduleIds: ["blackwood"],
    alwaysAvailable: true,
    buildItems: (sys) => [
      { label: "Slam Zone", value: `${sys.responderThresholds.slamMin}+ HCP` },
    ],
  },
  {
    id: "acbl-important-notes",
    title: "Important Notes",
    moduleIds: [],
    alwaysAvailable: false,
    buildItems: () => [],
  },
];

/** Build an ACBL-format convention card panel view with all 11 standard sections. */
export function buildAcblCardPanel(
  systemConfig: SystemConfig,
  conventionId?: string,
): AcblCardPanelView {
  const activeModuleIds = new Set<string>([
    ...getBaseModuleIds(systemConfig.systemId),
    ...(conventionId ? (getBundleInput(conventionId)?.memberIds ?? []) : []),
  ]);

  const sections: AcblCardSection[] = ACBL_SECTION_DEFS.map((def) => {
    const hasActiveModule = def.moduleIds.some((mid) => activeModuleIds.has(mid));
    const available = def.alwaysAvailable || hasActiveModule;

    const items = available ? def.buildItems(systemConfig, activeModuleIds) : [];
    const modules: ConventionCardModuleDetail[] = [];

    if (available) {
      for (const mid of def.moduleIds) {
        if (!activeModuleIds.has(mid)) continue;
        const detail = buildModuleDetail(mid, systemConfig);
        if (detail) modules.push(detail);
      }
    }

    return { id: def.id, title: def.title, available, items, modules };
  });

  return {
    partnership: "N-S",
    systemName: systemShortLabel(systemConfig),
    sections,
  };
}
