<script lang="ts">
  const { data } = $props();
</script>

<svelte:head>
  <title>{data.guide.title} — BridgeLab</title>
  <meta name="description" content={data.guide.description} />
  <meta property="og:title" content={data.guide.title} />
  <meta property="og:description" content={data.guide.description} />
  <meta property="og:type" content="article" />
</svelte:head>

<header class="guide-header">
  <h1>{data.guide.title}</h1>
  <p class="meta">{data.guide.date}</p>
</header>

<article class="guide-prose">
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted build-time markdown, not user input -->
  {@html data.guide.htmlContent}
</article>

<div class="cta">
  <p><strong>Ready to practice?</strong> Drill bridge conventions with instant feedback.</p>
  <a href="/">Open BridgeLab</a>
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

<style>
  .guide-header {
    margin-bottom: 2rem;
  }

  h1 {
    color: #e8edf5;
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    line-height: 1.3;
  }

  .meta {
    color: #64748b;
    font-size: 0.8rem;
  }

  .guide-prose :global(h2) {
    color: #e8edf5;
    font-size: 1.25rem;
    font-weight: 600;
    margin-top: 2em;
    margin-bottom: 0.5em;
  }

  .guide-prose :global(h3) {
    color: #e8edf5;
    font-size: 1.1rem;
    font-weight: 600;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }

  .guide-prose :global(p) {
    margin-bottom: 1em;
    font-size: 0.9375rem;
  }

  .guide-prose :global(strong) {
    color: #e8edf5;
    font-weight: 600;
  }

  .guide-prose :global(a) {
    color: #38bdf8;
    text-decoration: underline;
  }

  .guide-prose :global(ul),
  .guide-prose :global(ol) {
    margin-bottom: 1em;
    padding-left: 1.5em;
  }

  .guide-prose :global(li) {
    margin-bottom: 0.25em;
  }

  .guide-prose :global(blockquote) {
    border-left: 3px solid #1e293b;
    padding-left: 1em;
    color: #64748b;
    font-style: italic;
    margin-bottom: 1em;
  }

  .guide-prose :global(code) {
    background: #141b2d;
    padding: 0.15em 0.4em;
    border-radius: 4px;
    font-size: 0.85em;
  }

  .guide-prose :global(pre) {
    background: #141b2d;
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
    background: #141b2d;
    border: 1px solid #1e293b;
    border-radius: 12px;
    text-align: center;
  }

  .cta p {
    margin-bottom: 1rem;
    font-size: 0.9375rem;
  }

  .cta strong {
    color: #e8edf5;
  }

  .cta a {
    display: inline-block;
    background: #38bdf8;
    color: #0a0f1a;
    font-weight: 600;
    font-size: 0.875rem;
    padding: 0.625rem 1.5rem;
    border-radius: 8px;
    text-decoration: none;
  }

  .more-guides {
    margin-top: 2.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #1e293b;
  }

  .more-guides h3 {
    color: #64748b;
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
    color: #38bdf8;
    text-decoration: none;
    font-size: 0.875rem;
  }

  .more-guides a:hover {
    text-decoration: underline;
  }
</style>
