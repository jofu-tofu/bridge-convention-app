import type { PracticeFocus } from "./drill-types";
import { PracticeMode } from "./drill-types";
import { BidContext } from "../service/response-types";

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
  if (practiceMode === PracticeMode.DecisionDrill) {
    return BidContext.Target;
  }

  if (!matchedModuleId) {
    return BidContext.OffConvention;
  }

  if (practiceFocus.targetModuleIds.includes(matchedModuleId)) {
    return BidContext.Target;
  }

  if (practiceFocus.prerequisiteModuleIds.includes(matchedModuleId)) {
    return BidContext.Prerequisite;
  }

  if (practiceFocus.followUpModuleIds.includes(matchedModuleId)) {
    return BidContext.FollowUp;
  }

  if (practiceFocus.backgroundModuleIds.includes(matchedModuleId)) {
    return BidContext.Background;
  }

  return BidContext.OffConvention;
}
