<script lang="ts">
  import { FEATURES } from "../../../stores/feature-flags";
</script>

<section class="quick-actions">
  <h2>Quick actions</h2>
  <div class="actions">
    <a class="action" href="/practice">Pick a convention →</a>
    <a class="action" href="/learn">Learn a module →</a>
    {#if FEATURES.workshop}
      <a class="action" href="/workshop">Open workshop →</a>
    {/if}
  </div>
</section>

<style>
  .quick-actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  h2 {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    margin: 0;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .action {
    padding: 1rem 1.25rem;
    border: 1px solid var(--color-border-muted, rgba(148, 163, 184, 0.2));
    border-radius: 0.5rem;
    background: var(--color-bg-elevated, rgba(15, 23, 42, 0.4));
    color: var(--color-text-primary);
    text-decoration: none;
    font-weight: 500;
  }
  .action:hover {
    border-color: var(--color-accent-primary);
    color: var(--color-accent-primary);
  }
</style>
