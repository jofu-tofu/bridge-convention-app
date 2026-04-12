<script lang="ts">
  import ContinuationTree from "../../../../components/shared/reference/ContinuationTree.svelte";
  import DecisionGrid from "../../../../components/shared/reference/DecisionGrid.svelte";
  import InterferenceSection from "../../../../components/shared/reference/InterferenceSection.svelte";
  import QuickRefCard from "../../../../components/shared/reference/QuickRefCard.svelte";
  import RelatedLinks from "../../../../components/shared/reference/RelatedLinks.svelte";
  import ResponseTable from "../../../../components/shared/reference/ResponseTable.svelte";
  import SummaryCard from "../../../../components/shared/reference/SummaryCard.svelte";
  import SystemCompatRow from "../../../../components/shared/reference/SystemCompatRow.svelte";
  import WhenNotTable from "../../../../components/shared/reference/WhenNotTable.svelte";
  import WorkedAuction from "../../../../components/shared/reference/WorkedAuction.svelte";
  import ContentScreen from "../../../../components/shared/ContentScreen.svelte";
  import {
    buildPracticeUrl,
    normalizeContinuationPhases,
    normalizeReferenceView,
  } from "./reference-page";

  const { data } = $props();
  const viewport = data.viewport;

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${viewport.displayName} — Learn Bridge Conventions`,
    description: viewport.purpose,
    url: `https://bridgelab.net/learn/${viewport.moduleId}/`,
    publisher: { "@type": "Organization", name: "BridgeLab", url: "https://bridgelab.net" },
  });

  const reference = viewport.reference ? normalizeReferenceView(viewport.reference) : null;
  const continuationPhases = normalizeContinuationPhases(viewport.phases);
  const practiceHref = buildPracticeUrl(viewport.bundleIds, viewport.moduleId);

  const disclosureLabels: Record<string, string> = {
    alert: "Alert",
    announcement: "Announce",
    natural: "Natural",
    standard: "Standard",
  };

  const recColors: Record<string, string> = {
    must: "background: #166534; color: #bbf7d0;",
    should: "background: #1e40af; color: #bfdbfe;",
    may: "background: #854d0e; color: #fef08a;",
    avoid: "background: #991b1b; color: #fecaca;",
  };
</script>

<svelte:head>
  <title>{viewport.displayName} — Learn Bridge Conventions | BridgeLab</title>
  <meta name="description" content={viewport.purpose} />
  <link rel="canonical" href="https://bridgelab.net/learn/{viewport.moduleId}/" />
  <meta property="og:title" content="{viewport.displayName} — Learn Bridge Conventions" />
  <meta property="og:description" content={viewport.purpose} />
  <meta property="og:type" content="article" />
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted build-time JSON-LD, not user input -->
  {@html `<script type="application/ld+json">${jsonLd}<\/script>`}
</svelte:head>

<ContentScreen
  width="wide"
  title={viewport.displayName}
  subtitle={reference ? viewport.description : undefined}
>
  <a class="back-link" href="/learn/">← All Conventions</a>

<div class="page-wrap">
  {#if reference}
    <nav class="toc" aria-label="On this page">
      <p class="toc-title">On this page</p>
      <ol>
        <li><a href="#summary-card">Summary</a></li>
        <li><a href="#when-to-use">When to use</a></li>
        <li><a href="#response-table">Responses</a></li>
        <li><a href="#continuation-tree">Continuations</a></li>
        {#if reference.decisionGrid}<li><a href="#decision-grid">Decision grid</a></li>{/if}
        {#if reference.workedAuctions.length > 0}<li><a href="#worked-auctions">Worked auctions</a></li>{/if}
        {#if reference.interference.length > 0}<li><a href="#interference">Interference</a></li>{/if}
        <li><a href="#system-compatibility">System compatibility</a></li>
        {#if reference.relatedLinks.length > 0}<li><a href="#related-conventions">Related</a></li>{/if}
      </ol>
    </nav>
  {/if}
  <div class="screen-only">
    {#if reference}
      <div class="reference-stack">
        <div id="summary-card" class="scroll-target">
          <SummaryCard moduleId={viewport.moduleId} summaryCard={reference.summaryCard} />
        </div>

        <div id="when-to-use" class="scroll-target">
          <WhenNotTable whenToUse={reference.whenToUse} whenNotToUse={reference.whenNotToUse} />
        </div>

        <div id="response-table" class="scroll-target">
          <ResponseTable moduleId={viewport.moduleId} rows={reference.responseTableRows} />
        </div>

        <div id="continuation-tree" class="scroll-target">
          <ContinuationTree moduleId={viewport.moduleId} phases={continuationPhases} />
        </div>

        {#if reference.decisionGrid}
          <div id="decision-grid" class="scroll-target">
            <DecisionGrid decisionGrid={reference.decisionGrid} />
          </div>
        {/if}

        {#if reference.workedAuctions.length > 0}
          <div id="worked-auctions" class="scroll-target space-y-4" aria-label="Worked auctions">
            {#each reference.workedAuctions as auction (auction.label)}
              <WorkedAuction moduleId={viewport.moduleId} {auction} />
            {/each}
          </div>
        {/if}

        {#if reference.interference.length > 0}
          <div id="interference" class="scroll-target">
            <InterferenceSection items={reference.interference} />
          </div>
        {/if}

        <div id="system-compatibility" class="scroll-target">
          <SystemCompatRow systemCompat={reference.systemCompat} />
        </div>

        {#if reference.relatedLinks.length > 0}
          <div id="related-conventions" class="scroll-target">
            <RelatedLinks links={reference.relatedLinks} />
          </div>
        {/if}
      </div>
    {:else}
      <div class="hero">
        <p class="description">{viewport.description}</p>
        <p class="purpose">{viewport.purpose}</p>
        <a class="cta-button" href={practiceHref}>Practice this convention</a>
      </div>

      {#if viewport.teaching.principle || viewport.teaching.tradeoff || viewport.teaching.commonMistakes.length > 0}
        <section>
          <h2>Key Concepts</h2>
          {#if viewport.teaching.principle}
            <div class="teaching-card">
              <h3 class="teaching-label principle">Principle</h3>
              <p>{viewport.teaching.principle}</p>
            </div>
          {/if}
          {#if viewport.teaching.tradeoff}
            <div class="teaching-card">
              <h3 class="teaching-label tradeoff">Tradeoff</h3>
              <p>{viewport.teaching.tradeoff}</p>
            </div>
          {/if}
          {#if viewport.teaching.commonMistakes.length > 0}
            <div class="teaching-card">
              <h3 class="teaching-label mistakes">Common Mistakes</h3>
              <ul class="mistakes-list">
                {#each viewport.teaching.commonMistakes as mistake, i (i)}
                  <li>{mistake}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </section>
      {/if}

      {#if viewport.phases.length > 0}
        <section>
          <h2>Bidding Conversation</h2>
          {#each viewport.phases as phase (phase.phase)}
            <div class="phase-card">
              <div class="phase-header">
                <h3>{phase.phaseDisplay}</h3>
                {#if phase.transitionLabel}
                  <p class="transition-label">{phase.transitionLabel}</p>
                {/if}
              </div>
              <div class="surface-list">
                {#each phase.surfaces as surface (surface.meaningId)}
                  <div class="surface-row">
                    <div class="surface-header">
                      <span class="call-display">{surface.callDisplay}</span>
                      <span class="surface-name">{surface.teachingLabel.name}</span>
                      {#if surface.recommendation}
                        <span class="rec-badge" style={recColors[surface.recommendation] ?? "background: #374151; color: #d1d5db;"}>
                          {surface.recommendation}
                        </span>
                      {/if}
                      <span class="disclosure">{disclosureLabels[surface.disclosure] ?? surface.disclosure}</span>
                    </div>
                    {#if surface.explanationText && surface.explanationText !== "internal"}
                      <p class="explanation">{surface.explanationText}</p>
                    {/if}
                    {#if surface.clauses.length > 0}
                      <ul class="clause-list">
                        {#each surface.clauses as clause (clause.factId)}
                          <li class={clause.isPublic ? "clause-public" : "clause-private"}>
                            {clause.description}
                          </li>
                        {/each}
                      </ul>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </section>
      {/if}
    {/if}

    <div class="cta utility-chrome">
      <p><strong>Ready to practice?</strong> Drill {viewport.displayName} with instant feedback.</p>
      <a class="cta-button" href={practiceHref}>Practice {viewport.displayName}</a>
    </div>

    {#if data.otherModules.length > 0}
      <div class="more-modules utility-chrome">
        <h3>More Conventions</h3>
        <ul>
          {#each data.otherModules as mod (mod.moduleId)}
            <li>
              <a href="/learn/{mod.moduleId}/">
                <strong>{mod.displayName}</strong>
                <span>{mod.description}</span>
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  {#if reference}
    <div id="quick-reference" class="scroll-target">
      <QuickRefCard
        moduleId={viewport.moduleId}
        summaryCard={reference.summaryCard}
        responseTableRows={reference.responseTableRows}
      />
    </div>
  {/if}
</div>
</ContentScreen>

<style>
  .page-wrap {
    max-width: 960px;
    margin: 0 auto;
  }

  .toc {
    display: none;
  }

  @media (min-width: 1024px) {
    .page-wrap {
      display: grid;
      grid-template-columns: 200px minmax(0, 1fr);
      gap: 2.5rem;
      max-width: none;
      margin: 0;
      align-items: start;
    }
    .toc {
      display: block;
      position: sticky;
      top: 4rem;
      font-size: 0.875rem;
    }
    .screen-only {
      min-width: 0;
      max-width: 760px;
    }
    .toc-title {
      color: var(--color-text-muted);
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin: 0 0 0.75rem;
    }
    .toc ol {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .toc a {
      color: var(--color-text-secondary);
      text-decoration: none;
    }
    .toc a:hover,
    .toc a:focus-visible {
      color: var(--color-text-primary);
      text-decoration: underline;
    }
  }

  .screen-only {
    display: block;
  }

  .back-link {
    display: inline-block;
    color: var(--color-accent-primary);
    text-decoration: none;
    font-size: 0.875rem;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  .reference-stack {
    display: grid;
    gap: 1.5rem;
  }

  .scroll-target {
    scroll-margin-top: 6rem;
  }

  .hero {
    padding-bottom: 1.5rem;
    margin-bottom: 2rem;
    border-bottom: 1px solid #1e293b;
  }

  .description {
    font-size: 1rem;
    color: #94a3b8;
    margin-bottom: 0.5rem;
  }

  .purpose {
    font-size: 0.875rem;
    color: #64748b;
    font-style: italic;
    margin-bottom: 1.25rem;
  }

  .cta-button {
    display: inline-block;
    background: #38bdf8;
    color: #0a0f1a;
    font-weight: 600;
    font-size: 0.875rem;
    padding: 0.625rem 1.5rem;
    border-radius: 8px;
    text-decoration: none;
  }

  section {
    margin-bottom: 2rem;
  }

  h2 {
    color: #64748b;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.75rem;
  }

  .teaching-card {
    background: #141b2d;
    border: 1px solid #1e293b;
    border-radius: 10px;
    padding: 1rem;
    margin-bottom: 0.75rem;
  }

  .teaching-label {
    font-size: 0.75rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .principle { color: #38bdf8; }
  .tradeoff { color: #94a3b8; }
  .mistakes { color: #f87171; }

  .teaching-card p {
    font-size: 0.875rem;
    color: #e8edf5;
    line-height: 1.6;
  }

  .mistakes-list {
    list-style: none;
    padding: 0;
  }

  .mistakes-list li {
    font-size: 0.875rem;
    color: #e8edf5;
    line-height: 1.6;
    padding-left: 1rem;
    position: relative;
  }

  .mistakes-list li::before {
    content: "-";
    position: absolute;
    left: 0;
    color: #64748b;
  }

  .phase-card {
    background: #141b2d;
    border: 1px solid #1e293b;
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 1rem;
  }

  .phase-header {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #1e293b;
    background: #1a2235;
  }

  .phase-header h3 {
    color: #e8edf5;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .transition-label {
    color: #64748b;
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }

  .surface-row {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #1e293b;
  }

  .surface-row:last-child {
    border-bottom: none;
  }

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
    color: #e8edf5;
  }

  .surface-name {
    font-size: 0.875rem;
    color: #94a3b8;
  }

  .rec-badge {
    font-size: 0.7rem;
    font-weight: 500;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
  }

  .disclosure {
    font-size: 0.75rem;
    color: #64748b;
  }

  .explanation {
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 0.25rem;
    line-height: 1.5;
  }

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

  .clause-public { color: #94a3b8; }
  .clause-private { color: #64748b; font-style: italic; }

  .cta {
    margin-top: 3rem;
    padding: 1.5rem;
    background: #141b2d;
    border: 1px solid #1e293b;
    border-radius: 12px;
    text-align: center;
  }

  .cta p {
    margin-bottom: 1rem;
    font-size: 0.9375rem;
  }

  .cta strong { color: #e8edf5; }

  .more-modules {
    margin-top: 2.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #1e293b;
  }

  .more-modules h3 {
    color: #64748b;
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
    background: #141b2d;
    border: 1px solid #1e293b;
    border-radius: 8px;
    text-decoration: none;
    transition: border-color 0.15s;
  }

  .more-modules a:hover { border-color: #38bdf8; }

  .more-modules a strong {
    display: block;
    color: #e8edf5;
    font-size: 0.9rem;
    margin-bottom: 0.15rem;
  }

  .more-modules a span {
    display: block;
    color: #64748b;
    font-size: 0.8rem;
  }

  @media print {
    .screen-only {
      display: none;
    }

    .page-wrap {
      max-width: none;
      margin: 0;
    }
  }
</style>
