<script lang="ts">
  import ContentScreen from "../../../components/shared/ContentScreen.svelte";
</script>

<svelte:head>
  <title>Lessons — Learn Bridge Bidding | BridgeLab</title>
  <meta name="description" content="Guided walkthroughs that teach one bridge convention at a time using canonical example hands." />
  <link rel="canonical" href="https://bridgelab.net/lessons/" />
</svelte:head>

<ContentScreen
  title="Lessons"
  subtitle="Guided walkthroughs that teach one convention at a time using canonical example hands."
>
  <section class="placeholder">
    <h2>Coming soon</h2>
    <p>
      Structured lessons will step you through each convention with worked example hands,
      partner responses, and common pitfalls. Until they're ready, the convention
      <a href="/learn/">reference pages</a> cover the same material in a scan-friendly layout,
      and you can always drill any convention directly from <a href="/practice">Practice</a>.
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
