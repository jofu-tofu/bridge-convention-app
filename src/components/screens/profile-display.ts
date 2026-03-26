/**
 * Pure display logic for the System Profiles screen.
 * Categories, field accessors, value formatting, comparison helpers.
 */
import type { SystemConfig } from "../../service";

// ─── Types ────────────────────────────────────────────────────

type FieldFormat =
  | { type: "range"; min: (c: SystemConfig) => number; max: (c: SystemConfig) => number }
  | { type: "threshold"; value: (c: SystemConfig) => number }
  | { type: "enum"; value: (c: SystemConfig) => string; labels: Record<string, string> }
  | { type: "majorLength"; value: (c: SystemConfig) => 4 | 5 };

interface ProfileField {
  label: string;
  accessor: (c: SystemConfig) => unknown;
  format: FieldFormat;
}

interface ProfileCategory {
  label: string;
  fields: ProfileField[];
}

// ─── Formatting ───────────────────────────────────────────────

export function formatFieldValue(config: SystemConfig, field: ProfileField): string {
  const fmt = field.format;
  switch (fmt.type) {
    case "range":
      return `${fmt.min(config)}\u2013${fmt.max(config)} HCP`;
    case "threshold":
      return `${fmt.value(config)}+ HCP`;
    case "enum":
      return fmt.labels[fmt.value(config)] ?? fmt.value(config);
    case "majorLength": {
      const len = fmt.value(config);
      return len === 4 ? "4-card majors" : "5-card majors";
    }
  }
}

// ─── Comparison ───────────────────────────────────────────────

export function valuesMatch(configs: SystemConfig[], field: ProfileField): boolean {
  if (configs.length <= 1) return true;
  const first = formatFieldValue(configs[0]!, field);
  return configs.every((c) => formatFieldValue(c, field) === first);
}

// ─── Category definitions ─────────────────────────────────────

export const PROFILE_CATEGORIES: ProfileCategory[] = [
  {
    label: "1NT Opening",
    fields: [
      {
        label: "HCP Range",
        accessor: (c) => c.ntOpening,
        format: { type: "range", min: (c) => c.ntOpening.minHcp, max: (c) => c.ntOpening.maxHcp },
      },
    ],
  },
  {
    label: "Responder Thresholds",
    fields: [
      {
        label: "Invite Range",
        accessor: (c) => c.responderThresholds,
        format: { type: "range", min: (c) => c.responderThresholds.inviteMin, max: (c) => c.responderThresholds.inviteMax },
      },
      {
        label: "Game Minimum",
        accessor: (c) => c.responderThresholds.gameMin,
        format: { type: "threshold", value: (c) => c.responderThresholds.gameMin },
      },
      {
        label: "Slam Explore",
        accessor: (c) => c.responderThresholds.slamMin,
        format: { type: "threshold", value: (c) => c.responderThresholds.slamMin },
      },
    ],
  },
  {
    label: "Opener Rebid",
    fields: [
      {
        label: "Not Minimum",
        accessor: (c) => c.openerRebid.notMinimum,
        format: { type: "threshold", value: (c) => c.openerRebid.notMinimum },
      },
    ],
  },
  {
    label: "Suit Responses",
    fields: [
      {
        label: "2-Level Minimum",
        accessor: (c) => c.suitResponse.twoLevelMin,
        format: { type: "threshold", value: (c) => c.suitResponse.twoLevelMin },
      },
      {
        label: "Forcing Duration",
        accessor: (c) => c.suitResponse.twoLevelForcingDuration,
        format: {
          type: "enum",
          value: (c) => c.suitResponse.twoLevelForcingDuration,
          labels: { "one-round": "One Round", "game": "Game Forcing" },
        },
      },
    ],
  },
  {
    label: "1NT Response to 1M",
    fields: [
      {
        label: "Forcing Status",
        accessor: (c) => c.oneNtResponseAfterMajor.forcing,
        format: {
          type: "enum",
          value: (c) => c.oneNtResponseAfterMajor.forcing,
          labels: { "non-forcing": "Non-Forcing", "forcing": "Forcing", "semi-forcing": "Semi-Forcing" },
        },
      },
      {
        label: "HCP Range",
        accessor: (c) => c.oneNtResponseAfterMajor,
        format: { type: "range", min: (c) => c.oneNtResponseAfterMajor.minHcp, max: (c) => c.oneNtResponseAfterMajor.maxHcp },
      },
    ],
  },
  {
    label: "Opening Requirements",
    fields: [
      {
        label: "Major Suit Length",
        accessor: (c) => c.openingRequirements.majorSuitMinLength,
        format: { type: "majorLength", value: (c) => c.openingRequirements.majorSuitMinLength },
      },
    ],
  },
  {
    label: "Interference",
    fields: [
      {
        label: "Redouble Minimum",
        accessor: (c) => c.interference.redoubleMin,
        format: { type: "threshold", value: (c) => c.interference.redoubleMin },
      },
    ],
  },
  {
    label: "DONT Overcalls",
    fields: [
      {
        label: "HCP Range",
        accessor: (c) => c.dontOvercall,
        format: { type: "range", min: (c) => c.dontOvercall.minHcp, max: (c) => c.dontOvercall.maxHcp },
      },
    ],
  },
];
