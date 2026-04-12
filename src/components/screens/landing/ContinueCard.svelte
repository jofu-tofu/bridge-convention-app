<script lang="ts">
  import {
    displayConventionId,
    displaySystemId,
    displayPracticeMode,
    readLastConventionId,
    readPrefs,
  } from "./landing-helpers";

  const lastId = $derived(readLastConventionId());
  const prefs = $derived(readPrefs());
  const systemLabel = $derived(displaySystemId(prefs.baseSystemId));
  const modeLabel = $derived(displayPracticeMode(prefs.drill?.practiceMode));
  const conventionLabel = $derived(lastId ? displayConventionId(lastId) : null);
  const resumeHref = $derived(lastId ? `/game?convention=${lastId}` : null);
</script>

{#if lastId && resumeHref}
  <section class="continue-card">
    <div class="eyebrow">Continue</div>
    <div class="title">{conventionLabel}</div>
    <div class="meta">
      {#if systemLabel}<span>{systemLabel}</span>{/if}
      {#if systemLabel && modeLabel}<span class="dot">·</span>{/if}
      <span>{modeLabel}</span>
    </div>
    <a class="resume" href={resumeHref}>Resume practice →</a>
  </section>
{/if}

<style>
  .continue-card {
    padding: 2rem;
    border: 1px solid var(--color-accent-primary, rgba(99, 102, 241, 0.4));
    border-radius: 0.75rem;
    background: var(--color-bg-elevated, rgba(15, 23, 42, 0.6));
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .eyebrow {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-accent-primary);
  }
  .title {
    font-size: 1.75rem;
    color: var(--color-text-primary);
    font-weight: 600;
  }
  .meta {
    color: var(--color-text-secondary);
    font-size: 0.95rem;
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .meta .dot {
    opacity: 0.6;
  }
  .resume {
    margin-top: 0.75rem;
    align-self: flex-start;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    background: var(--color-accent-primary);
    color: var(--color-text-on-accent);
    font-weight: 600;
    text-decoration: none;
  }
  .resume:hover {
    opacity: 0.9;
  }
</style>
