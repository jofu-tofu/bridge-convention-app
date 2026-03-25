<script lang="ts">
  import type { EvaluatedFacts } from "../../../service/debug-types";
  import { fmtFactValue } from "./debug-helpers";
  import DebugSection from "./DebugSection.svelte";

  interface Props {
    facts: EvaluatedFacts | null;
  }

  let { facts }: Props = $props();
</script>

<DebugSection title="Hand Facts" count={facts?.facts.size ?? null}>
  {#if facts}
    <table class="w-full text-[10px]">
      <tbody>
        {#each [...facts.facts.entries()].sort(([a], [b]) => a.localeCompare(b)) as [id, fv] (id)}
          <tr class="border-b border-border-subtle/20">
            <td class="py-0 pr-2 text-text-muted max-w-[180px] truncate" title={id}>{id}</td>
            <td class="py-0 text-text-primary font-semibold {typeof fv.value === 'boolean' ? (fv.value ? 'text-green-400' : 'text-red-400') : ''}">{fmtFactValue(fv.value)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <div class="text-text-muted italic text-[10px]">No facts</div>
  {/if}
</DebugSection>
