/**
 * Guide loader — imports all markdown files from content/guides/ at build time,
 * parses frontmatter + body, renders to HTML via marked. No runtime fetch.
 */

import { marked } from "marked";

export interface GuideEntry {
  slug: string;
  title: string;
  description: string;
  date: string;
  order: number;
  htmlContent: string;
}

interface FrontmatterResult {
  data: Record<string, string>;
  body: string;
}

function parseFrontmatter(raw: string): FrontmatterResult {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };

  const data: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    data[key] = val;
  }
  return { data, body: match[2]! };
}

const modules: Record<string, string> = import.meta.glob("/content/guides/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

function buildGuides(): GuideEntry[] {
  const entries: GuideEntry[] = [];

  for (const [, raw] of Object.entries(modules)) {
    const { data, body } = parseFrontmatter(raw);
    if (!data.slug || !data.title) continue;

    entries.push({
      slug: data.slug,
      title: data.title,
      description: data.description ?? "",
      date: data.date ?? "",
      order: Number(data.order) || 0,
      htmlContent: marked.parse(body, { async: false }),
    });
  }

  return entries.sort((a, b) => a.order - b.order);
}

export const guides: GuideEntry[] = buildGuides();

export function getGuideBySlug(slug: string): GuideEntry | undefined {
  return guides.find((g) => g.slug === slug);
}
