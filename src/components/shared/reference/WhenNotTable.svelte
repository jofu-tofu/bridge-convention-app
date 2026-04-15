<script lang="ts">
  import type { ReferencePredicateBullet, ReferenceWhenNotItem } from "./types";

  interface Props {
    whenToUse: readonly ReferencePredicateBullet[];
    whenNotToUse: readonly ReferenceWhenNotItem[];
  }

  let { whenToUse, whenNotToUse }: Props = $props();
  const expandedConditions = $state<Record<string, boolean>>({});
</script>

<section class="root rounded-[--radius-lg] border border-border-default bg-bg-card p-4" aria-labelledby="when-not-heading">
  <h2 id="when-not-heading" class="mb-4 text-[--text-heading] font-semibold text-text-primary">
    When To Use / When Not To Use
  </h2>

  <div class="grid gap-4 lg:grid-cols-2">
    <div class="rounded-[--radius-md] border border-border-subtle bg-bg-base/70 p-4">
      <h3 class="mb-3 text-[--text-body] font-semibold text-text-primary">When to use</h3>
      <ul class="space-y-2 pl-5 text-[--text-body] leading-6 text-text-secondary">
        {#each whenToUse as item, index (item.gloss)}
          {@const conditionId = `condition-${index}`}
          {#if item.gloss}
            <li class="list-disc">
              <div class="condition-row">
                <span>{item.gloss}</span>
                {#if item.predicateText}
                  <button
                    type="button"
                    class="condition-toggle"
                    aria-expanded={expandedConditions[item.gloss] ? "true" : "false"}
                    aria-controls={conditionId}
                    onclick={() => {
                      expandedConditions[item.gloss] = !expandedConditions[item.gloss];
                    }}
                  >
                    {expandedConditions[item.gloss] ? "Hide condition" : "Show condition"}
                    <span class="sr-only"> for: {item.gloss}</span>
                  </button>
                {/if}
              </div>
              {#if item.predicateText}
                <p
                  id={conditionId}
                  class="condition-text"
                  hidden={!expandedConditions[item.gloss]}
                >
                  {item.predicateText}
                </p>
              {/if}
            </li>
          {/if}
        {/each}
      </ul>
    </div>

    <div class="rounded-[--radius-md] border border-border-subtle bg-bg-base/70 p-4">
      <h3 class="mb-3 text-[--text-body] font-semibold text-text-primary">When not to use</h3>
      <ul class="space-y-2 pl-5 text-[--text-body] leading-6 text-text-secondary">
        {#each whenNotToUse as item (item.text)}
          <li class="list-disc">
            {item.text}
            {#if item.reason}
              <span class="text-text-muted"> ({item.reason})</span>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  </div>
</section>

<style>
  .condition-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.6rem;
  }

  .condition-toggle {
    appearance: none;
    border: 1px solid var(--color-border-default);
    border-radius: 9999px;
    padding: 0.1rem 0.6rem;
    font-size: var(--text-annotation, 0.7rem);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    background: transparent;
    cursor: pointer;
  }

  .condition-toggle:hover,
  .condition-toggle:focus-visible {
    color: var(--color-text-primary);
    border-color: var(--color-accent-primary);
  }

  .condition-text {
    color: var(--color-text-muted);
    font-size: var(--text-detail, 0.875rem);
    line-height: 1.5;
  }

  .condition-text {
    margin-top: 0.35rem;
  }

  @media print {
    .root {
      display: none;
    }
  }
</style>
