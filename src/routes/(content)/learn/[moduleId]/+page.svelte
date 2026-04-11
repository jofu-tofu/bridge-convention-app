<script lang="ts">
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

  function practiceUrl(): string {
    const bundle = viewport.bundleIds[0] ?? "nt-bundle";
    return `/?convention=${encodeURIComponent(bundle)}&learn=${encodeURIComponent(viewport.moduleId)}`;
  }
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

<div class="hero">
  <h1>{viewport.displayName}</h1>
  <p class="description">{viewport.description}</p>
  <p class="purpose">{viewport.purpose}</p>
  <a class="cta-button" href={practiceUrl()}>Practice this convention</a>
</div>

<!-- Teaching section -->
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

<!-- Phases / surfaces -->
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

<div class="cta">
  <p><strong>Ready to practice?</strong> Drill {viewport.displayName} with instant feedback.</p>
  <a class="cta-button" href={practiceUrl()}>Practice {viewport.displayName}</a>
</div>

{#if data.otherModules.length > 0}
  <div class="more-modules">
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

<style>
  .hero {
    padding-bottom: 1.5rem;
    margin-bottom: 2rem;
    border-bottom: 1px solid #1e293b;
  }

  h1 {
    color: #e8edf5;
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
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
</style>
