import type { ConventionConfig } from "../conventions/types";
import type { ConventionCategory } from "../conventions/types";

export function filterConventions(
  conventions: readonly ConventionConfig[],
  query: string,
  category: ConventionCategory | null,
): ConventionConfig[] {
  return conventions.filter((c) => {
    const matchesSearch =
      !query ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.description.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = !category || c.category === category;
    return matchesSearch && matchesCategory;
  });
}
