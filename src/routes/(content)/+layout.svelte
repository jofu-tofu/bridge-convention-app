<script lang="ts">
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

<div class="content-layout">
  <header class="site-header">
    <a href="https://bridgelab.net">BridgeLab</a>
  </header>
  {@render children()}
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    background: #0a0f1a;
    color: #94a3b8;
    line-height: 1.7;
    font-size: 16px;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .content-layout {
    max-width: 780px;
    margin: 0 auto;
    padding: 3rem 1.5rem;
  }

  .site-header {
    margin-bottom: 2.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #1e293b;
  }

  .site-header a {
    color: #38bdf8;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.875rem;
  }
</style>
