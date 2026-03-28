import type { PracticeFocus, PracticeMode } from "./drill-types";
import type { BidContext } from "../service/response-types";

/**
 * Determine bidContext for a user bid.
 *
 * 1. If practiceMode is "decision-drill", return "target" (all user bids are target)
 * 2. If matchedModuleId is in practiceFocus.targetModuleIds -> "target"
 * 3. If in prerequisiteModuleIds -> "prerequisite"
 * 4. If in followUpModuleIds -> "follow-up"
 * 5. Fallback: "off-convention"
 */
export function resolveBidContext(
  matchedModuleId: string | undefined,
  practiceFocus: PracticeFocus,
  practiceMode: PracticeMode,
): BidContext {
  if (practiceMode === "decision-drill") {
    return "target";
  }

  if (!matchedModuleId) {
    return "off-convention";
  }

  if (practiceFocus.targetModuleIds.includes(matchedModuleId)) {
    return "target";
  }

  if (practiceFocus.prerequisiteModuleIds.includes(matchedModuleId)) {
    return "prerequisite";
  }

  if (practiceFocus.followUpModuleIds.includes(matchedModuleId)) {
    return "follow-up";
  }

  if (practiceFocus.backgroundModuleIds.includes(matchedModuleId)) {
    return "background";
  }

  return "off-convention";
}
