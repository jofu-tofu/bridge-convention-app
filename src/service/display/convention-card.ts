import type { SystemConfig } from "../../conventions/definitions/system-config";
import type { ConventionCardView } from "../response-types";

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
