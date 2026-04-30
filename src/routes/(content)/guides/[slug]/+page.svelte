<script lang="ts">
  import ContentScreen from "../../../../components/shared/ContentScreen.svelte";
  import AppLink from "../../../../components/shared/AppLink.svelte";
  const { data } = $props();
</script>

<svelte:head>
  <title>{data.guide.title} — BridgeLab</title>
  <meta name="description" content={data.guide.description} />
  <meta property="og:title" content={data.guide.title} />
  <meta property="og:description" content={data.guide.description} />
  <meta property="og:type" content="article" />
</svelte:head>

<ContentScreen width="narrow" title={data.guide.title} subtitle={data.guide.date}>
  <div class="back-link-wrap">
    <AppLink variant="back" href="/guides/">All Guides</AppLink>
  </div>

  <p class="meta-line">{data.guide.readingMinutes} min read</p>

  <article class="guide-prose">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted build-time markdown, not user input -->
    {@html data.guide.htmlContent}
  </article>

  <div class="cta">
    <p><strong>Ready to practice?</strong> Drill bridge conventions with instant feedback.</p>
    <a href="/practice">Open BridgeLab</a>
  </div>

  {#if data.otherGuides.length > 0}
    <div class="more-guides">
      <h3>More Guides</h3>
      <ul>
        {#each data.otherGuides as other (other.slug)}
          <li><a href="/guides/{other.slug}/">{other.title}</a></li>
        {/each}
      </ul>
    </div>
  {/if}
</ContentScreen>

<style>
  .back-link-wrap {
    margin-bottom: 1rem;
  }

  .meta-line {
    color: var(--color-text-muted);
    font-size: 0.8125rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-bottom: 2rem;
  }

  .guide-prose {
    max-width: 38rem;
    color: var(--color-text-secondary);
    font-size: 1.0625rem;
    line-height: 1.7;
    /* establish a block formatting context so floated pull-quotes
       don't bleed into siblings outside .guide-prose */
    display: flow-root;
  }

  .guide-prose :global(h2) {
    color: var(--color-text-primary);
    font-size: 1.375rem;
    font-weight: 600;
    line-height: 1.3;
    margin-top: 2.5em;
    margin-bottom: 0.6em;
    padding-top: 0.4em;
    border-top: 1px solid var(--color-border-subtle);
    clear: right;
  }

  .guide-prose :global(h2:first-child) {
    border-top: none;
    padding-top: 0;
    margin-top: 0;
  }

  .guide-prose :global(h3) {
    color: var(--color-text-primary);
    font-size: 1.125rem;
    font-weight: 600;
    margin-top: 1.75em;
    margin-bottom: 0.5em;
  }

  .guide-prose :global(p) {
    margin-bottom: 1.1em;
  }

  .guide-prose :global(p:first-of-type) {
    font-size: 1.1875rem;
    line-height: 1.55;
    color: var(--color-text-primary);
  }

  .guide-prose :global(strong),
  .guide-prose :global(em) {
    color: var(--color-text-primary);
  }

  .guide-prose :global(strong) {
    font-weight: 600;
  }

  .guide-prose :global(a) {
    color: var(--color-accent-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .guide-prose :global(ul),
  .guide-prose :global(ol) {
    margin-bottom: 1.1em;
    padding-left: 1.5em;
  }

  .guide-prose :global(li) {
    margin-bottom: 0.35em;
  }

  .guide-prose :global(blockquote) {
    border-left: 3px solid var(--color-border-subtle);
    padding-left: 1em;
    color: var(--color-text-muted);
    font-style: italic;
    margin-bottom: 1.1em;
  }

  .guide-prose :global(.pullquote) {
    display: block;
    margin: 1.75em 0;
    padding: 0.25em 0 0.25em 1.25em;
    border-left: 3px solid var(--color-accent-primary);
    color: var(--color-text-primary);
    font-size: 1.25rem;
    line-height: 1.4;
    font-weight: 500;
    font-style: italic;
  }

  @media (min-width: 900px) {
    .guide-prose :global(.pullquote) {
      float: right;
      width: 17rem;
      margin: 0.4em -2rem 1em 1.5em;
      padding-left: 1.25em;
      font-size: 1.3125rem;
    }
  }

  .guide-prose :global(code) {
    background: var(--color-bg-card);
    padding: 0.15em 0.4em;
    border-radius: 4px;
    font-size: 0.85em;
  }

  .guide-prose :global(pre) {
    background: var(--color-bg-card);
    padding: 1em;
    border-radius: 8px;
    overflow-x: auto;
    margin-bottom: 1em;
  }

  .guide-prose :global(pre code) {
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

  .cta strong {
    color: var(--color-text-primary);
  }

  .cta a {
    display: inline-block;
    background: var(--color-accent-primary);
    color: var(--color-text-inverse);
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

  .more-guides li {
    margin-bottom: 0.5rem;
  }

  .more-guides a {
    color: var(--color-accent-primary);
    text-decoration: none;
    font-size: 0.875rem;
  }

  .more-guides a:hover {
    text-decoration: underline;
  }
</style>
