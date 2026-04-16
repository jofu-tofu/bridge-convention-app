<script lang="ts">
  import ContentScreen from "../../../components/shared/ContentScreen.svelte";
</script>

<svelte:head>
  <title>Bidding Systems — SAYC, 2/1, Acol | BridgeLab</title>
  <meta name="description" content="Read-only reference for SAYC, 2/1, and Acol bidding systems — thresholds, point formulas, and convention defaults side-by-side." />
  <link rel="canonical" href="https://bridgelab.net/systems/" />
</svelte:head>

<ContentScreen
  title="Bidding Systems"
  subtitle="Read-only reference for SAYC, 2/1, and Acol — thresholds, point formulas, and convention defaults side-by-side."
>
  <section class="placeholder">
    <h2>Coming soon</h2>
    <p>
      A side-by-side comparison of the major bidding systems — opening thresholds,
      point formulas (HCP, total-points, LTC), and which conventions are defaults in each —
      is in the works. In the meantime, pick a system from
      <a href="/settings">Settings</a> and explore individual conventions under
      <a href="/learn/">Learn</a>.
    </p>
  </section>
</ContentScreen>

<style>
  .placeholder {
    padding: 1.5rem;
    background: var(--color-bg-elevated, #141b2d);
    border: 1px solid var(--color-border-default, #1e293b);
    border-radius: 12px;
  }

  .placeholder h2 {
    margin: 0 0 0.5rem;
    color: var(--color-text-primary, #e8edf5);
    font-size: 1rem;
  }

  .placeholder p {
    margin: 0;
    color: var(--color-text-muted, #94a3b8);
    font-size: 0.9375rem;
    line-height: 1.5;
  }

  .placeholder a {
    color: var(--color-accent-primary, #38bdf8);
    text-decoration: none;
  }

  .placeholder a:hover { text-decoration: underline; }
</style>
