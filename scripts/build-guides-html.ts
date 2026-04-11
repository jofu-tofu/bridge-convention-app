/**
 * Static HTML generator for guide pages (SEO).
 *
 * Reads markdown files from content/guides/, renders each to a standalone
 * HTML page at dist/guides/<slug>/index.html. These are served directly
 * by Caddy — no JS, no WASM required.
 *
 * Run: tsx scripts/build-guides-html.ts
 * Called automatically at the end of `npm run build`.
 */

import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

interface GuideMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  order: number;
}

interface ParsedGuide extends GuideMeta {
  htmlContent: string;
}

function parseFrontmatter(raw: string): {
  data: Record<string, string>;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };

  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    data[key] = val;
  }
  return { data, body: match[2] };
}

function loadGuides(): ParsedGuide[] {
  const guidesDir = path.resolve("content/guides");
  if (!fs.existsSync(guidesDir)) {
    console.log("No content/guides/ directory found — skipping static guide generation.");
    return [];
  }

  const files = fs.readdirSync(guidesDir).filter((f) => f.endsWith(".md"));
  const guides: ParsedGuide[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(guidesDir, file), "utf-8");
    const { data, body } = parseFrontmatter(raw);
    if (!data.slug || !data.title) {
      console.warn(`Skipping ${file}: missing slug or title in frontmatter`);
      continue;
    }

    guides.push({
      slug: data.slug,
      title: data.title,
      description: data.description ?? "",
      date: data.date ?? "",
      order: Number(data.order) || 0,
      htmlContent: marked.parse(body, { async: false }) as string,
    });
  }

  return guides.sort((a, b) => a.order - b.order);
}

function buildPageHtml(guide: ParsedGuide, allGuides: ParsedGuide[]): string {
  const otherGuides = allGuides
    .filter((g) => g.slug !== guide.slug)
    .map(
      (g) =>
        `<li><a href="/guides/${g.slug}/">${g.title}</a></li>`,
    )
    .join("\n          ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${guide.title} — BridgeLab</title>
  <meta name="description" content="${guide.description}" />

  <!-- Open Graph -->
  <meta property="og:title" content="${guide.title}" />
  <meta property="og:description" content="${guide.description}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://bridgelab.net/guides/${guide.slug}/" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

  <style>
    :root {
      --color-bg-deepest: #0a0f1a;
      --color-bg-card: #141b2d;
      --color-text-primary: #e8edf5;
      --color-text-secondary: #94a3b8;
      --color-text-muted: #64748b;
      --color-accent-primary: #38bdf8;
      --color-border-subtle: #1e293b;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      background: var(--color-bg-deepest);
      color: var(--color-text-secondary);
      line-height: 1.7;
      font-size: 16px;
    }

    .container {
      max-width: 720px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }

    .site-header {
      margin-bottom: 2.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--color-border-subtle);
    }

    .site-header a {
      color: var(--color-accent-primary);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.875rem;
    }

    header h1 {
      color: var(--color-text-primary);
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      line-height: 1.3;
    }

    header .meta {
      color: var(--color-text-muted);
      font-size: 0.8rem;
    }

    article { margin-top: 2rem; }

    article h2 {
      color: var(--color-text-primary);
      font-size: 1.25rem;
      font-weight: 600;
      margin-top: 2em;
      margin-bottom: 0.5em;
    }

    article h3 {
      color: var(--color-text-primary);
      font-size: 1.1rem;
      font-weight: 600;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }

    article p {
      margin-bottom: 1em;
      font-size: 0.9375rem;
    }

    article strong {
      color: var(--color-text-primary);
      font-weight: 600;
    }

    article a {
      color: var(--color-accent-primary);
      text-decoration: underline;
    }

    article ul, article ol {
      margin-bottom: 1em;
      padding-left: 1.5em;
    }

    article li { margin-bottom: 0.25em; }

    article blockquote {
      border-left: 3px solid var(--color-border-subtle);
      padding-left: 1em;
      color: var(--color-text-muted);
      font-style: italic;
      margin-bottom: 1em;
    }

    article code {
      background: var(--color-bg-card);
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-size: 0.85em;
    }

    article pre {
      background: var(--color-bg-card);
      padding: 1em;
      border-radius: 8px;
      overflow-x: auto;
      margin-bottom: 1em;
    }

    article pre code {
      background: none;
      padding: 0;
    }

    .cta {
      margin-top: 3rem;
      padding: 1.5rem;
      background: var(--color-bg-card);
      border: 1px solid var(--color-border-subtle);
      border-radius: 12px;
      text-align: center;
    }

    .cta p {
      margin-bottom: 1rem;
      font-size: 0.9375rem;
    }

    .cta a {
      display: inline-block;
      background: var(--color-accent-primary);
      color: var(--color-bg-deepest);
      font-weight: 600;
      font-size: 0.875rem;
      padding: 0.625rem 1.5rem;
      border-radius: 8px;
      text-decoration: none;
    }

    .more-guides {
      margin-top: 2.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--color-border-subtle);
    }

    .more-guides h3 {
      color: var(--color-text-muted);
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }

    .more-guides ul {
      list-style: none;
      padding: 0;
    }

    .more-guides li { margin-bottom: 0.5rem; }

    .more-guides a {
      color: var(--color-accent-primary);
      text-decoration: none;
      font-size: 0.875rem;
    }

    .more-guides a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="site-header">
      <a href="https://bridgelab.net">BridgeLab</a>
    </div>

    <header>
      <h1>${guide.title}</h1>
      <p class="meta">${guide.date}</p>
    </header>

    <article>
      ${guide.htmlContent}
    </article>

    <div class="cta">
      <p><strong>Ready to practice?</strong> Drill bridge conventions with instant feedback.</p>
      <a href="https://bridgelab.net">Open BridgeLab</a>
    </div>

    ${
      otherGuides
        ? `<div class="more-guides">
      <h3>More Guides</h3>
      <ul>
        ${otherGuides}
      </ul>
    </div>`
        : ""
    }
  </div>
</body>
</html>`;
}

function buildIndexHtml(allGuides: ParsedGuide[]): string {
  const guideLinks = allGuides
    .map(
      (g) =>
        `<li>
          <a href="/guides/${g.slug}/">
            <strong>${g.title}</strong>
            <span>${g.description}</span>
          </a>
        </li>`,
    )
    .join("\n        ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Guides — BridgeLab</title>
  <meta name="description" content="Bridge convention guides and articles" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

  <style>
    :root {
      --color-bg-deepest: #0a0f1a;
      --color-bg-card: #141b2d;
      --color-text-primary: #e8edf5;
      --color-text-secondary: #94a3b8;
      --color-text-muted: #64748b;
      --color-accent-primary: #38bdf8;
      --color-border-subtle: #1e293b;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      background: var(--color-bg-deepest);
      color: var(--color-text-secondary);
      line-height: 1.7;
      font-size: 16px;
    }

    .container {
      max-width: 720px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }

    .site-header {
      margin-bottom: 2.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--color-border-subtle);
    }

    .site-header a {
      color: var(--color-accent-primary);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.875rem;
    }

    h1 {
      color: var(--color-text-primary);
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
    }

    ul {
      list-style: none;
      padding: 0;
    }

    li {
      margin-bottom: 1rem;
    }

    li a {
      display: block;
      padding: 1rem 1.25rem;
      background: var(--color-bg-card);
      border: 1px solid var(--color-border-subtle);
      border-radius: 10px;
      text-decoration: none;
      transition: border-color 0.15s;
    }

    li a:hover {
      border-color: var(--color-accent-primary);
    }

    li a strong {
      display: block;
      color: var(--color-text-primary);
      font-size: 1rem;
      margin-bottom: 0.25rem;
    }

    li a span {
      display: block;
      color: var(--color-text-muted);
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="site-header">
      <a href="https://bridgelab.net">BridgeLab</a>
    </div>

    <h1>Guides</h1>

    <ul>
      ${guideLinks}
    </ul>
  </div>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────

const guides = loadGuides();

if (guides.length === 0) {
  console.log("No guides to generate.");
  process.exit(0);
}

const distDir = path.resolve("dist/guides");
fs.mkdirSync(distDir, { recursive: true });

// Generate individual guide pages
for (const guide of guides) {
  const outDir = path.join(distDir, guide.slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), buildPageHtml(guide, guides));
  console.log(`  guides/${guide.slug}/index.html`);
}

// Generate index page
fs.writeFileSync(path.join(distDir, "index.html"), buildIndexHtml(guides));
console.log(`  guides/index.html`);

console.log(`Generated ${guides.length} guide page(s) + index.`);
