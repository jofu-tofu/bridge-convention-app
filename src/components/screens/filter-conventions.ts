import type { ConventionConfig } from "../../service";
import type { ConventionCategory } from "../../service";

export function filterConventions(
  conventions: readonly ConventionConfig[],
  query: string,
  category: ConventionCategory | null,
): ConventionConfig[] {
  return conventions.filter((c) => {
    if (c.internal) return false;
    const matchesSearch =
      !query ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.description.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = !category || c.category === category;
    return matchesSearch && matchesCategory;
  });
}
