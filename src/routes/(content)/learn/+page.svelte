<script lang="ts">
  const { data } = $props();
</script>

<svelte:head>
  <title>Learn Bridge Conventions | BridgeLab</title>
  <meta name="description" content="Learn bridge bidding conventions — Stayman, Jacoby Transfers, Bergen Raises, DONT, and more." />
  <link rel="canonical" href="https://bridgelab.net/learn/" />
</svelte:head>

<h1>Learn Bridge Conventions</h1>
<p class="subtitle">Master bridge bidding conventions with detailed explanations and interactive practice drills.</p>

<ul class="module-list">
  {#each data.modules as mod (mod.moduleId)}
    <li>
      <a href="/learn/{mod.moduleId}/">
        <strong>{mod.displayName}</strong>
        <span>{mod.description}</span>
        <span class="surface-count">{mod.surfaceCount} modeled bids</span>
      </a>
    </li>
  {/each}
</ul>

<div class="cta">
  <p><strong>Ready to practice?</strong> Drill bridge conventions with instant feedback.</p>
  <a href="/">Open BridgeLab</a>
</div>

<style>
  h1 {
    color: #e8edf5;
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: #64748b;
    font-size: 0.9375rem;
    margin-bottom: 2rem;
  }

  .module-list {
    list-style: none;
    padding: 0;
  }

  .module-list li {
    margin-bottom: 1rem;
  }

  .module-list a {
    display: block;
    padding: 1rem 1.25rem;
    background: #141b2d;
    border: 1px solid #1e293b;
    border-radius: 10px;
    text-decoration: none;
    transition: border-color 0.15s;
  }

  .module-list a:hover {
    border-color: #38bdf8;
  }

  .module-list a strong {
    display: block;
    color: #e8edf5;
    font-size: 1rem;
    margin-bottom: 0.25rem;
  }

  .module-list a span {
    display: block;
    color: #64748b;
    font-size: 0.875rem;
  }

  .surface-count {
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }

  .cta {
    margin-top: 2.5rem;
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
</style>
