<script lang="ts">
  import type { ReferenceWhenNotItem } from "./types";

  interface Props {
    whenToUse: readonly string[];
    whenNotToUse: readonly ReferenceWhenNotItem[];
  }

  let { whenToUse, whenNotToUse }: Props = $props();
</script>

<section class="root rounded-[--radius-lg] border border-border-default bg-bg-card p-4" aria-labelledby="when-not-heading">
  <h2 id="when-not-heading" class="mb-4 text-[--text-heading] font-semibold text-text-primary">
    When To Use / When Not To Use
  </h2>

  <div class="grid gap-4 lg:grid-cols-2">
    <div class="rounded-[--radius-md] border border-border-subtle bg-bg-base/70 p-4">
      <h3 class="mb-3 text-[--text-body] font-semibold text-text-primary">When to use</h3>
      <ul class="space-y-2 pl-5 text-[--text-body] leading-6 text-text-secondary">
        {#each whenToUse as item (item)}
          <li class="list-disc">{item}</li>
        {/each}
      </ul>
    </div>

    <div class="rounded-[--radius-md] border border-border-subtle bg-bg-base/70 p-4">
      <h3 class="mb-3 text-[--text-body] font-semibold text-text-primary">When not to use</h3>
      <ul class="space-y-2 pl-5 text-[--text-body] leading-6 text-text-secondary">
        {#each whenNotToUse as item (item.text)}
          <li class="list-disc">
            {item.text}
            <span class="text-text-muted"> ({item.reason})</span>
          </li>
        {/each}
      </ul>
    </div>
  </div>
</section>

<style>
  @media print {
    .root {
      display: none;
    }
  }
</style>
