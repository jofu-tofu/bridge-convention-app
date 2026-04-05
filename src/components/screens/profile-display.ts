/**
 * Pure display logic for the System Profiles screen.
 * Categories, value formatting, comparison helpers.
 */
import type { SystemConfig, TotalPointEquivalent } from "../../service";

// ─── Types ────────────────────────────────────────────────────

export type FieldFormat =
  | { type: "range"; min: (c: SystemConfig) => number; max: (c: SystemConfig) => number }
  | { type: "threshold"; value: (c: SystemConfig) => number }
  | { type: "rangeWithTp";
      min: (c: SystemConfig) => number; max: (c: SystemConfig) => number;
      minTp: (c: SystemConfig) => TotalPointEquivalent;
      maxTp: (c: SystemConfig) => TotalPointEquivalent }
  | { type: "thresholdWithTp";
      value: (c: SystemConfig) => number;
      tp: (c: SystemConfig) => TotalPointEquivalent }
  | { type: "enum"; value: (c: SystemConfig) => string; labels: Record<string, string> }
  | { type: "majorLength"; value: (c: SystemConfig) => 4 | 5 };

export interface ProfileField {
  label: string;
  format: FieldFormat;
}

export interface ProfileCategory {
  label: string;
  fields: ProfileField[];
  hasTotalPoints?: boolean;
}

// ─── Formatting ───────────────────────────────────────────────

export function formatFieldValue(config: SystemConfig, field: ProfileField): string {
  const fmt = field.format;
  switch (fmt.type) {
    case "range":
    case "rangeWithTp":
      return `${fmt.min(config)}\u2013${fmt.max(config)} HCP`;
    case "threshold":
    case "thresholdWithTp":
      return `${fmt.value(config)}+ HCP`;
    case "enum":
      return fmt.labels[fmt.value(config)] ?? fmt.value(config);
    case "majorLength": {
      const len = fmt.value(config);
      return len === 4 ? "4-card majors" : "5-card majors";
    }
  }
}

function formatTotalPointValue(
  config: SystemConfig,
  field: ProfileField,
  pointKind: "trump" | "nt",
): string {
  const fmt = field.format;
  if (fmt.type === "rangeWithTp") {
    return `${fmt.minTp(config)[pointKind]}\u2013${fmt.maxTp(config)[pointKind]} TP`;
  }
  if (fmt.type === "thresholdWithTp") {
    return `${fmt.tp(config)[pointKind]}+ TP`;
  }
  return "";
}

/** Format the trump total-point value for a field. Returns "" for non-TP fields. */
export function formatTrumpTpValue(config: SystemConfig, field: ProfileField): string {
  return formatTotalPointValue(config, field, "trump");
}

/** Format the NT total-point value for a field. Returns "" for non-TP fields. */
export function formatNtTpValue(config: SystemConfig, field: ProfileField): string {
  return formatTotalPointValue(config, field, "nt");
}

// ─── Comparison ───────────────────────────────────────────────

function valuesMatchFormatted(
  configs: SystemConfig[],
  field: ProfileField,
  formatter: (config: SystemConfig, field: ProfileField) => string,
): boolean {
  if (configs.length <= 1) return true;
  const first = formatter(configs[0]!, field);
  return configs.every((c) => formatter(c, field) === first);
}

export function valuesMatch(configs: SystemConfig[], field: ProfileField): boolean {
  return valuesMatchFormatted(configs, field, formatFieldValue);
}

export function valuesMatchTrumpTp(configs: SystemConfig[], field: ProfileField): boolean {
  return valuesMatchFormatted(configs, field, formatTrumpTpValue);
}

export function valuesMatchNtTp(configs: SystemConfig[], field: ProfileField): boolean {
  return valuesMatchFormatted(configs, field, formatNtTpValue);
}

// ─── Category definitions ─────────────────────────────────────

export const PROFILE_CATEGORIES: ProfileCategory[] = [
  {
    label: "1NT Opening",
    fields: [
      {
        label: "HCP Range",
        format: { type: "range", min: (c) => c.ntOpening.minHcp, max: (c) => c.ntOpening.maxHcp },
      },
    ],
  },
  {
    label: "Responder Thresholds",
    hasTotalPoints: true,
    fields: [
      {
        label: "Invite Range",
        format: {
          type: "rangeWithTp",
          min: (c) => c.responderThresholds.inviteMin,
          max: (c) => c.responderThresholds.inviteMax,
          minTp: (c) => c.responderThresholds.inviteMinTp,
          maxTp: (c) => c.responderThresholds.inviteMaxTp,
        },
      },
      {
        label: "Game Minimum",
        format: {
          type: "thresholdWithTp",
          value: (c) => c.responderThresholds.gameMin,
          tp: (c) => c.responderThresholds.gameMinTp,
        },
      },
      {
        label: "Slam Explore",
        format: {
          type: "thresholdWithTp",
          value: (c) => c.responderThresholds.slamMin,
          tp: (c) => c.responderThresholds.slamMinTp,
        },
      },
    ],
  },
  {
    label: "Opener Rebid",
    hasTotalPoints: true,
    fields: [
      {
        label: "Not Minimum",
        format: {
          type: "thresholdWithTp",
          value: (c) => c.openerRebid.notMinimum,
          tp: (c) => c.openerRebid.notMinimumTp,
        },
      },
    ],
  },
  {
    label: "Suit Responses",
    fields: [
      {
        label: "2-Level Minimum",
        format: { type: "threshold", value: (c) => c.suitResponse.twoLevelMin },
      },
      {
        label: "Forcing Duration",
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
        format: {
          type: "enum",
          value: (c) => c.oneNtResponseAfterMajor.forcing,
          labels: { "non-forcing": "Non-Forcing", "forcing": "Forcing", "semi-forcing": "Semi-Forcing" },
        },
      },
      {
        label: "HCP Range",
        format: { type: "range", min: (c) => c.oneNtResponseAfterMajor.minHcp, max: (c) => c.oneNtResponseAfterMajor.maxHcp },
      },
    ],
  },
  {
    label: "Opening Requirements",
    fields: [
      {
        label: "Major Suit Length",
        format: { type: "majorLength", value: (c) => c.openingRequirements.majorSuitMinLength },
      },
    ],
  },
  {
    label: "Interference",
    fields: [
      {
        label: "Redouble Minimum",
        format: { type: "threshold", value: (c) => c.interference.redoubleMin },
      },
    ],
  },
  {
    label: "DONT Overcalls",
    fields: [
      {
        label: "HCP Range",
        format: { type: "range", min: (c) => c.dontOvercall.minHcp, max: (c) => c.dontOvercall.maxHcp },
      },
    ],
  },
];
