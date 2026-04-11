import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { error } from "@sveltejs/kit";

interface GuideData {
  slug: string;
  title: string;
  description: string;
  date: string;
  htmlContent: string;
}

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };

  const data: Record<string, string> = {};
  for (const line of (match[1] ?? "").split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    data[key] = val;
  }
  return { data, body: match[2] ?? "" };
}

function loadAllGuides(): GuideData[] {
  const guidesDir = path.resolve("content/guides");
  if (!fs.existsSync(guidesDir)) return [];

  const files = fs.readdirSync(guidesDir).filter((f) => f.endsWith(".md"));
  const guides: GuideData[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(guidesDir, file), "utf-8");
    const { data, body } = parseFrontmatter(raw);
    if (!data.slug || !data.title) continue;

    guides.push({
      slug: data.slug,
      title: data.title,
      description: data.description ?? "",
      date: data.date ?? "",
      htmlContent: String(marked.parse(body, { async: false })),
    });
  }

  return guides;
}

export function load({ params }: { params: { slug: string } }) {
  const guides = loadAllGuides();
  const guide = guides.find((g) => g.slug === params.slug);
  if (!guide) error(404, "Guide not found");

  const otherGuides = guides.filter((g) => g.slug !== params.slug).map((g) => ({
    slug: g.slug,
    title: g.title,
  }));

  return { guide, otherGuides };
}

export function entries() {
  const guides = loadAllGuides();
  return guides.map((g) => ({ slug: g.slug }));
}
