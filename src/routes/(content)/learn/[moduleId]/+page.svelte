<script lang="ts">
  import type { ModuleFlowTreeViewport } from "../../../../service";
  import ContinuationList from "../../../../components/shared/reference/ContinuationList.svelte";
  import FlowSummary from "../../../../components/shared/reference/FlowSummary.svelte";
  import OnThisPageNav from "../../../../components/shared/reference/OnThisPageNav.svelte";
  import QuickReference from "../../../../components/shared/reference/QuickReference.svelte";
  import InterferenceSection from "../../../../components/shared/reference/InterferenceSection.svelte";
  import QuickRefCard from "../../../../components/shared/reference/QuickRefCard.svelte";
  import RelatedLinks from "../../../../components/shared/reference/RelatedLinks.svelte";
  import ResponseTable from "../../../../components/shared/reference/ResponseTable.svelte";
  import SummaryCard from "../../../../components/shared/reference/SummaryCard.svelte";
  import WhenNotTable from "../../../../components/shared/reference/WhenNotTable.svelte";
  import WorkedAuctionCard from "../../../../components/shared/reference/WorkedAuctionCard.svelte";
  import ContentScreen from "../../../../components/shared/ContentScreen.svelte";
  import AppLink from "../../../../components/shared/AppLink.svelte";
  import {
    buildPracticeUrl,
    normalizeReferenceView,
  } from "./reference-page";
  import {
    OG_IMAGE,
    SITE_MODIFIED,
    SITE_NAME,
    SITE_PUBLISHED,
    SITE_URL,
    truncateDescription,
  } from "../../seo";

  const { data } = $props();
  const viewport = $derived(data.viewport);
  const pageUrl = $derived(`${SITE_URL}/learn/${viewport.moduleId}/`);
  const metaDescription = $derived(truncateDescription(viewport.purpose));

  const jsonLd = $derived(JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${viewport.displayName} — Learn Bridge Conventions`,
    description: metaDescription,
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    image: OG_IMAGE,
    datePublished: SITE_PUBLISHED,
    dateModified: SITE_MODIFIED,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/brand/logo.svg` },
    },
  }));

  const reference = $derived(normalizeReferenceView(viewport.reference));
  // Server-load returns a structurally equivalent mirror type; cast to service type.
  const flowTree = $derived(data.flowTree as ModuleFlowTreeViewport | null);
  const practiceHref = $derived(buildPracticeUrl(viewport.bundleIds, viewport.moduleId));

  const tocSections = $derived.by(() => {
    return [
      { id: "summary-card", label: "Summary" },
      { id: "when-to-use", label: "When to use" },
      { id: "response-table", label: "Responses" },
      ...(flowTree ? [{ id: "flow-summary", label: "Flow" }] : []),
      ...(flowTree ? [{ id: "continuations", label: "Continuations" }] : []),
      { id: "quick-reference", label: "Quick reference" },
      ...(reference.workedAuctions.length > 0
        ? [{ id: "worked-auctions", label: "Worked auctions" }]
        : []),
      { id: "interference", label: "Interference" },
      ...(reference.relatedLinks.length > 0
        ? [{ id: "related-conventions", label: "Related" }]
        : []),
    ];
  });
</script>

<svelte:head>
  <title>{viewport.displayName} — Learn Bridge Conventions | BridgeLab</title>
  <meta name="description" content={metaDescription} />
  <link rel="canonical" href={pageUrl} />
  <meta property="og:title" content="{viewport.displayName} — Learn Bridge Conventions" />
  <meta property="og:description" content={metaDescription} />
  <meta property="og:type" content="article" />
  <meta property="og:url" content={pageUrl} />
  <meta property="article:published_time" content={SITE_PUBLISHED} />
  <meta property="article:modified_time" content={SITE_MODIFIED} />
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted build-time JSON-LD, not user input -->
  {@html `<script type="application/ld+json">${jsonLd}<\/script>`}
</svelte:head>

<ContentScreen
  width="reference"
  title={viewport.displayName}
  subtitle={viewport.description}
>
  <div class="back-link-wrap">
    <AppLink variant="back" href="/learn/">All Conventions</AppLink>
  </div>

<div class="page-wrap">
  <div class="screen-only">
    <div class="reference-stack">
      <div id="summary-card" class="scroll-target">
        <SummaryCard moduleId={viewport.moduleId} summaryCard={reference.summaryCard} />
      </div>

      <div id="when-to-use" class="scroll-target">
        <WhenNotTable whenToUse={reference.whenToUse} whenNotToUse={reference.whenNotToUse} />
      </div>

      <div id="response-table" class="scroll-target wide">
        <ResponseTable moduleId={viewport.moduleId} responseTable={reference.responseTable} />
      </div>

      {#if flowTree}
        <div id="flow-summary" class="scroll-target wide">
          <FlowSummary tree={flowTree} />
        </div>

        <div id="continuations" class="scroll-target wide">
          <ContinuationList moduleId={viewport.moduleId} tree={flowTree} />
        </div>
      {/if}

      <div id="quick-reference" class="scroll-target wide">
        <QuickReference quickReference={reference.quickReference} />
      </div>

      {#if reference.workedAuctions.length > 0}
        <div id="worked-auctions" class="scroll-target space-y-4" aria-label="Worked auctions">
          {#each reference.workedAuctions as auction (auction.label)}
            <WorkedAuctionCard moduleId={viewport.moduleId} {auction} />
          {/each}
        </div>
      {/if}

      <div id="interference" class="scroll-target wide">
        <InterferenceSection interference={reference.interference} />
      </div>

      {#if reference.relatedLinks.length > 0}
        <div id="related-conventions" class="scroll-target">
          <RelatedLinks links={reference.relatedLinks} />
        </div>
      {/if}
    </div>

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

  <div class="toc-col">
    <OnThisPageNav sections={tocSections} />
  </div>

  <div class="scroll-target print-only">
    <QuickRefCard
      moduleId={viewport.moduleId}
      summaryCard={reference.summaryCard}
      responseTable={reference.responseTable}
    />
  </div>
</div>
</ContentScreen>

<style>
  .page-wrap {
    margin: 0 auto;
  }

  .reference-stack > :not(.wide),
  .cta,
  .more-modules {
    max-width: 720px;
    margin-inline: auto;
  }

  .toc-col {
    display: none;
  }

  @media (min-width: 1536px) {
    .page-wrap {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 240px;
      gap: 2rem;
      margin: 0;
      align-items: start;
    }
    .screen-only {
      min-width: 0;
      width: 100%;
    }
    .toc-col {
      display: block;
      position: sticky;
      top: 4rem;
      align-self: start;
    }
  }

  .screen-only {
    display: block;
  }

  .back-link-wrap {
    margin-bottom: 1rem;
  }

  .reference-stack {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1.5rem;
  }

  .scroll-target {
    min-width: 0;
    scroll-margin-top: 6rem;
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
