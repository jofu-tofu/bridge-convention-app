import type { ConventionCategory, ConventionInfo } from "../../service";

export function filterConventions(
  conventions: readonly ConventionInfo[],
  query: string,
  category: ConventionCategory | null,
): ConventionInfo[] {
  const lowerQuery = query.toLowerCase();
  return conventions.filter((c) => {
    const matchesSearch =
      !query ||
      c.name.toLowerCase().includes(lowerQuery) ||
      (c.description ?? "").toLowerCase().includes(lowerQuery);
    const matchesCategory = !category || c.category === category;
    return matchesSearch && matchesCategory;
  });
}
