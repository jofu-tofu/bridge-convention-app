<script lang="ts">
  import AppShell from "../../components/navigation/AppShell.svelte";

  const { children } = $props();
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<AppShell>
  <div class="content-layout">
    {@render children()}
  </div>
</AppShell>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    background: var(--color-bg-deepest);
    color: var(--color-text-secondary);
    line-height: 1.7;
    font-size: 16px;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .content-layout {
    max-width: 1100px;
    margin: 0 auto;
    padding: 3rem 1.5rem;
    width: 100%;
  }

  @media (min-width: 1024px) {
    .content-layout {
      margin-left: calc(var(--rail-width, 80px) + 1rem);
      margin-right: auto;
      max-width: calc(100vw - var(--rail-width, 80px) - 2rem);
    }
  }

  @media (max-width: 1023px) {
    .content-layout {
      padding: 2rem 1rem;
    }
  }
</style>
