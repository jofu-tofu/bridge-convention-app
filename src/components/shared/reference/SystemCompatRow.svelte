<script lang="ts">
  import type { ReferenceSystemCompat } from "./types";

  interface Props {
    systemCompat: ReferenceSystemCompat;
  }

  let { systemCompat }: Props = $props();

  const cells = $derived([
    { label: "SAYC", value: systemCompat.sayc },
    { label: "2/1", value: systemCompat.twoOverOne },
    { label: "Acol", value: systemCompat.acol },
    { label: "Custom", value: systemCompat.customNote },
  ]);
</script>

<section class="root rounded-[--radius-lg] border border-border-default bg-bg-card p-4" aria-labelledby="system-compat-heading">
  <h2 id="system-compat-heading" class="mb-4 text-[--text-heading] font-semibold text-text-primary">
    System Compatibility
  </h2>

  <div class="overflow-x-auto">
    <table class="min-w-full border-separate border-spacing-0 text-left" aria-label="System compatibility">
      <thead>
        <tr>
          {#each cells as cell (cell.label)}
            <th class="border-b border-border-default px-4 py-3 text-[--text-label] uppercase tracking-[0.12em] text-text-muted">{cell.label}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        <tr>
          {#each cells as cell (cell.label)}
            <td class="border-b border-border-subtle px-4 py-4 align-top break-words text-[--text-body] leading-6 text-text-secondary">
              {cell.value}
            </td>
          {/each}
        </tr>
      </tbody>
    </table>
  </div>
</section>

<style>
  @media print {
    .root {
      display: none;
    }
  }
</style>
