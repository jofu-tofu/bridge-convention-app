<script lang="ts">
  import type { EvaluatedFacts } from "../../../core/contracts/fact-catalog";
  import { fmtFactValue } from "./debug-helpers";

  interface Props {
    facts: EvaluatedFacts | null;
  }

  let { facts }: Props = $props();
</script>

<details>
  <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">
    Hand Facts
    {#if facts}<span class="text-text-muted font-normal">({facts.facts.size})</span>{/if}
  </summary>
  <div class="pl-2 py-1">
    {#if facts}
      <table class="w-full">
        <tbody>
          {#each [...facts.facts.entries()].sort(([a], [b]) => a.localeCompare(b)) as [id, fv] (id)}
            <tr class="border-b border-border-subtle/30">
              <td class="py-0.5 pr-2 text-text-muted max-w-[180px] truncate" title={id}>{id}</td>
              <td class="py-0.5 text-text-primary font-semibold {typeof fv.value === 'boolean' ? (fv.value ? 'text-green-400' : 'text-red-400') : ''}">{fmtFactValue(fv.value)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <div class="text-text-muted italic">No facts (not user's turn or no strategy)</div>
    {/if}
  </div>
</details>
