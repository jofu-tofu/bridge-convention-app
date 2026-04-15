/**
 * Stable deep-link contract. Output of this function is a load-bearing URL fragment —
 * do not change the rule without a redirect plan for bookmarked links. All fragment
 * generation MUST route through this helper; ad-hoc string manipulation of meaningId
 * for URL purposes is forbidden.
 */
export function slugifyMeaningId(moduleId: string, meaningId: string): string {
  const meaningIdSlug = meaningId.replaceAll(":", "-");
  if (meaningId.startsWith(`${moduleId}:`)) {
    return meaningIdSlug;
  }
  return `${moduleId}-${meaningIdSlug}`;
}
