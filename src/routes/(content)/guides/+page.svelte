<script lang="ts">
  import { guides } from "../../../content/guides";
  import ContentScreen from "../../../components/shared/ContentScreen.svelte";
</script>

<svelte:head>
  <title>Bridge Guides — BridgeLab</title>
  <meta name="description" content="Guides and essays on bridge bidding, conventions, and learning." />
  <meta property="og:title" content="Bridge Guides — BridgeLab" />
  <meta property="og:description" content="Guides and essays on bridge bidding, conventions, and learning." />
  <meta property="og:type" content="website" />
</svelte:head>

<ContentScreen
  title="Guides"
  subtitle="Essays and explainers on bridge bidding, conventions, and how to learn them."
>
  <ul class="guide-grid">
    {#each guides as guide (guide.slug)}
      <li>
        <a class="guide-card" href="/guides/{guide.slug}/">
          <h2>{guide.title}</h2>
          {#if guide.description}
            <p class="description">{guide.description}</p>
          {/if}
          {#if guide.date}
            <p class="meta">{guide.date}</p>
          {/if}
        </a>
      </li>
    {/each}
  </ul>
</ContentScreen>

<style>
  .guide-grid {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .guide-card {
    display: block;
    padding: 1.25rem;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border-subtle);
    border-radius: 12px;
    text-decoration: none;
    color: inherit;
    height: 100%;
    transition: border-color 0.15s, transform 0.15s;
  }

  .guide-card:hover {
    border-color: var(--color-accent-primary);
    transform: translateY(-2px);
  }

  .guide-card h2 {
    color: var(--color-text-primary);
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
    line-height: 1.3;
  }

  .description {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    margin: 0 0 0.75rem;
    line-height: 1.5;
  }

  .meta {
    color: var(--color-text-muted);
    font-size: 0.75rem;
    margin: 0;
  }
</style>
