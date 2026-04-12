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
  {@render children()}
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
</style>
