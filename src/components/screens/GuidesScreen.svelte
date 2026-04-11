<script lang="ts">
  import { guides } from "../../content/guides";
  import CardSurface from "../shared/CardSurface.svelte";

  const INITIAL_SLUG = guides[0]?.slug ?? "";
  let selectedSlug = $state(INITIAL_SLUG);
  const selectedGuide = $derived(guides.find((g) => g.slug === selectedSlug));
</script>

<div class="h-full overflow-hidden flex">
  <!-- Sidebar: guide list -->
  <div
    class="w-64 shrink-0 border-r border-border-subtle overflow-y-auto p-4 hidden lg:block"
  >
    <h2 class="text-sm font-semibold text-text-muted uppercase tracking-wide mb-4">
      Guides
    </h2>
    <ul class="space-y-2">
      {#each guides as guide (guide.slug)}
        <li>
          <button
            class="w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer
              {guide.slug === selectedSlug
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated/50'}"
            onclick={() => (selectedSlug = guide.slug)}
          >
            <span class="text-sm font-medium block">{guide.title}</span>
            <span class="text-xs text-text-muted block mt-0.5">{guide.date}</span>
          </button>
        </li>
      {/each}
    </ul>
  </div>

  <!-- Main content -->
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-3xl mx-auto px-6 py-8">
      <!-- Mobile guide selector -->
      <div class="lg:hidden mb-6">
        <select
          class="w-full bg-bg-elevated text-text-primary border border-border-subtle rounded-lg px-3 py-2 text-sm"
          onchange={(e) =>
            (selectedSlug = (e.target as HTMLSelectElement).value)}
        >
          {#each guides as guide (guide.slug)}
            <option value={guide.slug} selected={guide.slug === selectedSlug}
              >{guide.title}</option
            >
          {/each}
        </select>
      </div>

      {#if selectedGuide}
        <CardSurface class="p-8">
          <header class="mb-8">
            <h1 class="text-2xl font-bold text-text-primary mb-2">
              {selectedGuide.title}
            </h1>
            <p class="text-base text-text-muted">{selectedGuide.description}</p>
            <p class="text-xs text-text-muted mt-2">{selectedGuide.date}</p>
          </header>

          <article class="guide-prose">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted build-time markdown, not user input -->
            {@html selectedGuide.htmlContent}
          </article>
        </CardSurface>
      {/if}
    </div>
  </div>
</div>

<style>
  .guide-prose :global(h1),
  .guide-prose :global(h2),
  .guide-prose :global(h3) {
    color: var(--color-text-primary);
    font-weight: 600;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }

  .guide-prose :global(h2) {
    font-size: 1.25rem;
  }

  .guide-prose :global(h3) {
    font-size: 1.1rem;
  }

  .guide-prose :global(p) {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    line-height: 1.7;
    margin-bottom: 1em;
  }

  .guide-prose :global(strong) {
    color: var(--color-text-primary);
    font-weight: 600;
  }

  .guide-prose :global(a) {
    color: var(--color-accent-primary);
    text-decoration: underline;
  }

  .guide-prose :global(ul),
  .guide-prose :global(ol) {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    line-height: 1.7;
    margin-bottom: 1em;
    padding-left: 1.5em;
  }

  .guide-prose :global(li) {
    margin-bottom: 0.25em;
  }

  .guide-prose :global(blockquote) {
    border-left: 3px solid var(--color-border-subtle);
    padding-left: 1em;
    color: var(--color-text-muted);
    font-style: italic;
    margin-bottom: 1em;
  }

  .guide-prose :global(code) {
    background: var(--color-bg-elevated);
    padding: 0.15em 0.4em;
    border-radius: 4px;
    font-size: 0.85em;
  }

  .guide-prose :global(pre) {
    background: var(--color-bg-elevated);
    padding: 1em;
    border-radius: 8px;
    overflow-x: auto;
    margin-bottom: 1em;
  }

  .guide-prose :global(pre code) {
    background: none;
    padding: 0;
  }
</style>
