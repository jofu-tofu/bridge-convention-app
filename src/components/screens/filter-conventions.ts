import type { ConventionInfo } from "../../service";
import type { ConventionCategory } from "../../service";

export function filterConventions(
  conventions: readonly ConventionInfo[],
  query: string,
  category: ConventionCategory | null,
): ConventionInfo[] {
  return conventions.filter((c) => {
    const matchesSearch =
      !query ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      (c.description ?? "").toLowerCase().includes(query.toLowerCase());
    const matchesCategory = !category || c.category === category;
    return matchesSearch && matchesCategory;
  });
}
