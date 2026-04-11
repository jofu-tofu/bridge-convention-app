/**
 * Static HTML generator for learn pages (SEO).
 *
 * Reads JSON from dist/.static/learn-data.json (produced by bridge-static binary),
 * renders each module to a standalone HTML page at dist/learn/<moduleId>/index.html.
 * These are served directly by Caddy — no JS, no WASM required.
 *
 * Run: tsx scripts/build-learn-html.ts
 * Called automatically at the end of `npm run build`.
 */

import fs from "node:fs";
import path from "node:path";

// ── Types (documenting what Rust produces — NOT a separate schema) ───

interface StaticLearnData {
  modules: ModuleCatalogEntry[];
  viewports: Record<
    string,
    { learning: ModuleLearningViewport; flowTree: ModuleFlowTreeViewport | null }
  >;
}

interface ModuleCatalogEntry {
  moduleId: string;
  displayName: string;
  description: string;
  purpose: string;
  surfaceCount: number;
  bundleIds: string[];
}

interface ModuleLearningViewport {
  moduleId: string;
  displayName: string;
  description: string;
  purpose: string;
  teaching: {
    tradeoff: string | null;
    principle: string | null;
    commonMistakes: string[];
  };
  phases: PhaseGroupView[];
  bundleIds: string[];
}

interface PhaseGroupView {
  phase: string;
  phaseDisplay: string;
  turn: string | null;
  transitionLabel: string | null;
  surfaces: SurfaceDetailView[];
}

interface SurfaceDetailView {
  meaningId: string;
  teachingLabel: { name: string; summary: string };
  callDisplay: string;
  disclosure: string;
  recommendation: string | null;
  explanationText: string | null;
  clauses: SurfaceClauseView[];
}

interface SurfaceClauseView {
  factId: string;
  operator: string;
  description: string;
  isPublic: boolean;
}

interface ModuleFlowTreeViewport {
  moduleId: string;
  moduleName: string;
  root: FlowTreeNode;
  nodeCount: number;
  maxDepth: number;
}

interface FlowTreeNode {
  id: string;
  callDisplay: string | null;
  turn: string | null;
  label: string;
  moduleId: string | null;
  meaningId: string | null;
  children: FlowTreeNode[];
  depth: number;
  recommendation: string | null;
  disclosure: string | null;
  explanationText: string | null;
  clauses: SurfaceClauseView[];
}

// ── Helpers ──────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function recommendationBadge(rec: string | null): string {
  if (!rec) return "";
  const colors: Record<string, string> = {
    must: "background: #166534; color: #bbf7d0;",
    should: "background: #1e40af; color: #bfdbfe;",
    may: "background: #854d0e; color: #fef08a;",
    avoid: "background: #991b1b; color: #fecaca;",
  };
  const style = colors[rec] ?? "background: #374151; color: #d1d5db;";
  return `<span class="rec-badge" style="${style}">${escapeHtml(rec)}</span>`;
}

function disclosureLabel(d: string): string {
  const labels: Record<string, string> = {
    alert: "Alert",
    announcement: "Announce",
    natural: "Natural",
    standard: "Standard",
  };
  return labels[d] ?? d;
}

function practiceUrl(bundleIds: string[], moduleId: string): string {
  const bundle = bundleIds[0] ?? "nt-bundle";
  return `/?convention=${encodeURIComponent(bundle)}&learn=${encodeURIComponent(moduleId)}`;
}

// ── Flow Tree Renderer ──────────────────────────────────────────────

function renderFlowTreeNode(node: FlowTreeNode): string {
  const callPart = node.callDisplay
    ? `<span class="flow-call">${escapeHtml(node.callDisplay)}</span> `
    : "";
  const turnPart = node.turn
    ? `<span class="flow-turn">${escapeHtml(node.turn)}</span>`
    : "";
  const recPart = recommendationBadge(node.recommendation);

  const childrenHtml =
    node.children.length > 0
      ? `<ul class="flow-tree">${node.children.map(renderFlowTreeNode).join("")}</ul>`
      : "";

  return `<li class="flow-node depth-${node.depth}">
    <div class="flow-node-content">${callPart}${escapeHtml(node.label)} ${turnPart} ${recPart}</div>
    ${childrenHtml}
  </li>`;
}

function renderFlowTree(tree: ModuleFlowTreeViewport): string {
  if (!tree.root.children.length) return "";
  return `<section class="flow-tree-section">
    <h2>Conversation Flow</h2>
    <ul class="flow-tree flow-tree-root">
      ${tree.root.children.map(renderFlowTreeNode).join("")}
    </ul>
  </section>`;
}

// ── Page Templates ──────────────────────────────────────────────────

function buildModulePageHtml(
  viewport: ModuleLearningViewport,
  flowTree: ModuleFlowTreeViewport | null,
  allModules: ModuleCatalogEntry[],
): string {
  const pUrl = practiceUrl(viewport.bundleIds, viewport.moduleId);

  // Teaching section
  let teachingHtml = "";
  const t = viewport.teaching;
  if (t.principle || t.tradeoff || t.commonMistakes.length > 0) {
    let cards = "";
    if (t.principle) {
      cards += `<div class="teaching-card">
        <h3 class="teaching-label principle-label">Principle</h3>
        <p>${escapeHtml(t.principle)}</p>
      </div>`;
    }
    if (t.tradeoff) {
      cards += `<div class="teaching-card">
        <h3 class="teaching-label tradeoff-label">Tradeoff</h3>
        <p>${escapeHtml(t.tradeoff)}</p>
      </div>`;
    }
    if (t.commonMistakes.length > 0) {
      const items = t.commonMistakes
        .map((m) => `<li>${escapeHtml(m)}</li>`)
        .join("");
      cards += `<div class="teaching-card">
        <h3 class="teaching-label mistakes-label">Common Mistakes</h3>
        <ul class="mistakes-list">${items}</ul>
      </div>`;
    }
    teachingHtml = `<section class="teaching-section">
      <h2>Key Concepts</h2>
      ${cards}
    </section>`;
  }

  // Flow tree
  const flowTreeHtml = flowTree ? renderFlowTree(flowTree) : "";

  // Phases / surfaces
  let phasesHtml = "";
  if (viewport.phases.length > 0) {
    const phaseCards = viewport.phases
      .map((phase) => {
        const transitionHtml = phase.transitionLabel
          ? `<p class="transition-label">${escapeHtml(phase.transitionLabel)}</p>`
          : "";

        const surfaceRows = phase.surfaces
          .map((s) => {
            const explanationHtml =
              s.explanationText && s.explanationText !== "internal"
                ? `<p class="explanation">${escapeHtml(s.explanationText)}</p>`
                : "";

            const clauseItems = s.clauses
              .map(
                (c) =>
                  `<li class="${c.isPublic ? "clause-public" : "clause-private"}">${escapeHtml(c.description)}</li>`,
              )
              .join("");
            const clausesHtml =
              s.clauses.length > 0
                ? `<ul class="clause-list">${clauseItems}</ul>`
                : "";

            return `<div class="surface-row">
              <div class="surface-header">
                <span class="call-display">${escapeHtml(s.callDisplay)}</span>
                <span class="surface-name">${escapeHtml(s.teachingLabel.name)}</span>
                ${recommendationBadge(s.recommendation)}
                <span class="disclosure">${escapeHtml(disclosureLabel(s.disclosure))}</span>
              </div>
              ${explanationHtml}
              ${clausesHtml}
            </div>`;
          })
          .join("");

        return `<div class="phase-card">
          <div class="phase-header">
            <h3>${escapeHtml(phase.phaseDisplay)}</h3>
            ${transitionHtml}
          </div>
          <div class="surface-list">${surfaceRows}</div>
        </div>`;
      })
      .join("");

    phasesHtml = `<section class="phases-section">
      <h2>Bidding Conversation</h2>
      ${phaseCards}
    </section>`;
  }

  // Other modules links
  const otherModules = allModules
    .filter((m) => m.moduleId !== viewport.moduleId)
    .map(
      (m) =>
        `<li><a href="/learn/${m.moduleId}/"><strong>${escapeHtml(m.displayName)}</strong><span>${escapeHtml(m.description)}</span></a></li>`,
    )
    .join("\n          ");

  // JSON-LD
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${viewport.displayName} — Learn Bridge Conventions`,
    description: viewport.purpose,
    url: `https://bridgelab.net/learn/${viewport.moduleId}/`,
    publisher: {
      "@type": "Organization",
      name: "BridgeLab",
      url: "https://bridgelab.net",
    },
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(viewport.displayName)} — Learn Bridge Conventions | BridgeLab</title>
  <meta name="description" content="${escapeHtml(viewport.purpose)}" />
  <link rel="canonical" href="https://bridgelab.net/learn/${viewport.moduleId}/" />

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(viewport.displayName)} — Learn Bridge Conventions" />
  <meta property="og:description" content="${escapeHtml(viewport.purpose)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://bridgelab.net/learn/${viewport.moduleId}/" />

  <!-- JSON-LD -->
  <script type="application/ld+json">${jsonLd}</script>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

  <style>
    :root {
      --color-bg-deepest: #0a0f1a;
      --color-bg-card: #141b2d;
      --color-bg-elevated: #1a2235;
      --color-text-primary: #e8edf5;
      --color-text-secondary: #94a3b8;
      --color-text-muted: #64748b;
      --color-accent-primary: #38bdf8;
      --color-accent-danger: #f87171;
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
      max-width: 780px;
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

    /* Hero */
    .hero {
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--color-border-subtle);
    }

    .hero h1 {
      color: var(--color-text-primary);
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .hero .description {
      font-size: 1rem;
      color: var(--color-text-secondary);
      margin-bottom: 0.5rem;
    }

    .hero .purpose {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      font-style: italic;
      margin-bottom: 1.25rem;
    }

    .cta-button {
      display: inline-block;
      background: var(--color-accent-primary);
      color: var(--color-bg-deepest);
      font-weight: 600;
      font-size: 0.875rem;
      padding: 0.625rem 1.5rem;
      border-radius: 8px;
      text-decoration: none;
    }

    /* Section headers */
    h2 {
      color: var(--color-text-muted);
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }

    section { margin-bottom: 2rem; }

    /* Teaching cards */
    .teaching-card {
      background: var(--color-bg-card);
      border: 1px solid var(--color-border-subtle);
      border-radius: 10px;
      padding: 1rem;
      margin-bottom: 0.75rem;
    }

    .teaching-label {
      font-size: 0.75rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .principle-label { color: var(--color-accent-primary); }
    .tradeoff-label { color: var(--color-text-secondary); }
    .mistakes-label { color: var(--color-accent-danger); }

    .teaching-card p {
      font-size: 0.875rem;
      color: var(--color-text-primary);
      line-height: 1.6;
    }

    .mistakes-list {
      list-style: none;
      padding: 0;
    }

    .mistakes-list li {
      font-size: 0.875rem;
      color: var(--color-text-primary);
      line-height: 1.6;
      padding-left: 1rem;
      position: relative;
    }

    .mistakes-list li::before {
      content: "-";
      position: absolute;
      left: 0;
      color: var(--color-text-muted);
    }

    /* Flow tree */
    .flow-tree-section { margin-bottom: 2rem; }

    .flow-tree {
      list-style: none;
      padding-left: 1.25rem;
    }

    .flow-tree-root {
      background: var(--color-bg-card);
      border: 1px solid var(--color-border-subtle);
      border-radius: 10px;
      padding: 1rem 1rem 1rem 1.5rem;
    }

    .flow-node {
      position: relative;
      margin-bottom: 0.25rem;
    }

    .flow-node-content {
      font-size: 0.875rem;
      color: var(--color-text-secondary);
      padding: 0.2rem 0;
    }

    .flow-call {
      font-family: monospace;
      font-weight: 700;
      color: var(--color-text-primary);
    }

    .flow-turn {
      font-size: 0.7rem;
      color: var(--color-text-muted);
      font-style: italic;
    }

    /* Phase cards */
    .phase-card {
      background: var(--color-bg-card);
      border: 1px solid var(--color-border-subtle);
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 1rem;
    }

    .phase-header {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--color-border-subtle);
      background: var(--color-bg-elevated);
    }

    .phase-header h3 {
      color: var(--color-text-primary);
      font-size: 0.875rem;
      font-weight: 600;
    }

    .transition-label {
      color: var(--color-text-muted);
      font-size: 0.75rem;
      margin-top: 0.25rem;
    }

    /* Surface rows */
    .surface-row {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--color-border-subtle);
    }

    .surface-row:last-child { border-bottom: none; }

    .surface-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .call-display {
      font-family: monospace;
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--color-text-primary);
    }

    .surface-name {
      font-size: 0.875rem;
      color: var(--color-text-secondary);
    }

    .rec-badge {
      font-size: 0.7rem;
      font-weight: 500;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
    }

    .disclosure {
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }

    .explanation {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      margin-top: 0.25rem;
      line-height: 1.5;
    }

    /* Clause list */
    .clause-list {
      list-style: none;
      padding: 0;
      margin-top: 0.5rem;
      margin-left: 1rem;
    }

    .clause-list li {
      font-size: 0.75rem;
      padding: 0.1rem 0;
    }

    .clause-public { color: var(--color-text-secondary); }
    .clause-private { color: var(--color-text-muted); font-style: italic; }

    /* Footer CTA */
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

    .cta strong { color: var(--color-text-primary); }

    /* More modules */
    .more-modules {
      margin-top: 2.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--color-border-subtle);
    }

    .more-modules h3 {
      color: var(--color-text-muted);
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }

    .more-modules ul { list-style: none; padding: 0; }
    .more-modules li { margin-bottom: 0.5rem; }

    .more-modules a {
      display: block;
      padding: 0.75rem 1rem;
      background: var(--color-bg-card);
      border: 1px solid var(--color-border-subtle);
      border-radius: 8px;
      text-decoration: none;
      transition: border-color 0.15s;
    }

    .more-modules a:hover { border-color: var(--color-accent-primary); }

    .more-modules a strong {
      display: block;
      color: var(--color-text-primary);
      font-size: 0.9rem;
      margin-bottom: 0.15rem;
    }

    .more-modules a span {
      display: block;
      color: var(--color-text-muted);
      font-size: 0.8rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="site-header">
      <a href="https://bridgelab.net">BridgeLab</a>
    </div>

    <div class="hero">
      <h1>${escapeHtml(viewport.displayName)}</h1>
      <p class="description">${escapeHtml(viewport.description)}</p>
      <p class="purpose">${escapeHtml(viewport.purpose)}</p>
      <a class="cta-button" href="${pUrl}">Practice this convention</a>
    </div>

    ${flowTreeHtml}

    ${teachingHtml}

    ${phasesHtml}

    <div class="cta">
      <p><strong>Ready to practice?</strong> Drill ${escapeHtml(viewport.displayName)} with instant feedback.</p>
      <a class="cta-button" href="${pUrl}">Practice ${escapeHtml(viewport.displayName)}</a>
    </div>

    <div class="more-modules">
      <h3>More Conventions</h3>
      <ul>
        ${otherModules}
      </ul>
    </div>
  </div>
</body>
</html>`;
}

function buildIndexHtml(modules: ModuleCatalogEntry[]): string {
  const moduleLinks = modules
    .map(
      (m) =>
        `<li>
          <a href="/learn/${m.moduleId}/">
            <strong>${escapeHtml(m.displayName)}</strong>
            <span>${escapeHtml(m.description)}</span>
            <span class="surface-count">${m.surfaceCount} modeled bids</span>
          </a>
        </li>`,
    )
    .join("\n        ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Learn Bridge Conventions | BridgeLab</title>
  <meta name="description" content="Learn bridge bidding conventions — Stayman, Jacoby Transfers, Bergen Raises, DONT, and more. Interactive teaching with practice drills." />
  <link rel="canonical" href="https://bridgelab.net/learn/" />

  <meta property="og:title" content="Learn Bridge Conventions | BridgeLab" />
  <meta property="og:description" content="Learn bridge bidding conventions with interactive teaching and practice drills." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://bridgelab.net/learn/" />

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
      max-width: 780px;
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
      margin-bottom: 0.5rem;
    }

    .subtitle {
      color: var(--color-text-muted);
      font-size: 0.9375rem;
      margin-bottom: 2rem;
    }

    ul { list-style: none; padding: 0; }

    li { margin-bottom: 1rem; }

    li a {
      display: block;
      padding: 1rem 1.25rem;
      background: var(--color-bg-card);
      border: 1px solid var(--color-border-subtle);
      border-radius: 10px;
      text-decoration: none;
      transition: border-color 0.15s;
    }

    li a:hover { border-color: var(--color-accent-primary); }

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

    .surface-count {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      margin-top: 0.25rem;
    }

    .cta {
      margin-top: 2.5rem;
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

    .cta strong { color: var(--color-text-primary); }

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
  </style>
</head>
<body>
  <div class="container">
    <div class="site-header">
      <a href="https://bridgelab.net">BridgeLab</a>
    </div>

    <h1>Learn Bridge Conventions</h1>
    <p class="subtitle">Master bridge bidding conventions with detailed explanations and interactive practice drills.</p>

    <ul>
      ${moduleLinks}
    </ul>

    <div class="cta">
      <p><strong>Ready to practice?</strong> Drill bridge conventions with instant feedback.</p>
      <a href="https://bridgelab.net">Open BridgeLab</a>
    </div>
  </div>
</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────────────

const dataPath = path.resolve("dist/.static/learn-data.json");
if (!fs.existsSync(dataPath)) {
  console.error(`ERROR: ${dataPath} not found. Run bridge-static first.`);
  process.exit(1);
}

const raw = fs.readFileSync(dataPath, "utf-8");
const data: StaticLearnData = JSON.parse(raw);

if (data.modules.length === 0) {
  console.log("No modules to generate.");
  process.exit(0);
}

const distDir = path.resolve("dist/learn");
fs.mkdirSync(distDir, { recursive: true });

// Generate individual module pages
for (const mod of data.modules) {
  const vp = data.viewports[mod.moduleId];
  if (!vp) {
    console.warn(`  WARN: No viewport data for ${mod.moduleId}, skipping`);
    continue;
  }

  const outDir = path.join(distDir, mod.moduleId);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "index.html"),
    buildModulePageHtml(vp.learning, vp.flowTree, data.modules),
  );
  console.log(`  learn/${mod.moduleId}/index.html`);
}

// Generate index page
fs.writeFileSync(path.join(distDir, "index.html"), buildIndexHtml(data.modules));
console.log(`  learn/index.html`);

console.log(`Generated ${data.modules.length} learn page(s) + index.`);
