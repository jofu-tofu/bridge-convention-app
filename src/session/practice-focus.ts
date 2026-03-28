import type { PracticeFocus } from "./drill-types";

/**
 * Derive module roles relative to the practice target.
 *
 * - No targetModuleId -> all modules are targets (full bundle practice)
 * - targetModuleId specified -> that module is target, earlier memberIds are prerequisites, later are follow-ups
 * - If targetModuleId not found in memberIds, falls back to all-targets
 */
export function derivePracticeFocus(
  memberIds: readonly string[],
  targetModuleId?: string,
  backgroundModuleIds?: readonly string[],
): PracticeFocus {
  const bg = backgroundModuleIds ?? [];

  if (!targetModuleId) {
    return {
      targetModuleIds: memberIds,
      prerequisiteModuleIds: [],
      followUpModuleIds: [],
      backgroundModuleIds: bg,
    };
  }

  const idx = memberIds.indexOf(targetModuleId);
  if (idx === -1) {
    return {
      targetModuleIds: memberIds,
      prerequisiteModuleIds: [],
      followUpModuleIds: [],
      backgroundModuleIds: bg,
    };
  }

  return {
    targetModuleIds: [targetModuleId],
    prerequisiteModuleIds: memberIds.slice(0, idx),
    followUpModuleIds: memberIds.slice(idx + 1),
    backgroundModuleIds: bg,
  };
}
