import fs from "node:fs";
import path from "node:path";
import { SITE_URL } from "../(content)/seo";

export const prerender = true;

interface LearnDataFile {
  modules?: { moduleId: string }[];
}

function learnModuleIds(): string[] {
  const candidates = [
    path.resolve(".generated/learn-data.json"),
    path.resolve("dist/.generated/learn-data.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, "utf-8")) as LearnDataFile;
      return (data.modules ?? []).map((m) => m.moduleId);
    }
  }
  return [];
}

function guideSlugs(): string[] {
  const dir = path.resolve("content/guides");
  if (!fs.existsSync(dir)) return [];
  const slugs: string[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const raw = fs.readFileSync(path.join(dir, file), "utf-8");
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) continue;
    const slugLine = (match[1] ?? "").split("\n").find((l) => l.trim().startsWith("slug:"));
    if (!slugLine) continue;
    const idx = slugLine.indexOf(":");
    const val = slugLine.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (val) slugs.push(val);
  }
  return slugs;
}

export function GET() {
  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/learn/`,
    `${SITE_URL}/lessons/`,
    `${SITE_URL}/systems/`,
    `${SITE_URL}/guides/`,
    ...learnModuleIds().map((id) => `${SITE_URL}/learn/${id}/`),
    ...guideSlugs().map((slug) => `${SITE_URL}/guides/${slug}/`),
  ];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n") +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
