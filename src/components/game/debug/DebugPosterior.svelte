<script lang="ts">
  import type { PosteriorSummary } from "../../../core/contracts";

  interface Props {
    posteriorSummary: PosteriorSummary | null;
  }

  let { posteriorSummary }: Props = $props();
</script>

<details>
  <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">
    Posterior
    {#if posteriorSummary}
      <span class="text-text-muted font-normal">({posteriorSummary.sampleCount} samples)</span>
    {/if}
  </summary>
  <div class="pl-2 py-1">
    {#if posteriorSummary}
      {@const ps = posteriorSummary}
      <div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 mb-1">
        <span class="text-text-muted">samples</span>
        <span class="text-text-primary">{ps.sampleCount}</span>
        <span class="text-text-muted">confidence</span>
        <span class="text-text-primary">{(ps.confidence * 100).toFixed(1)}%</span>
      </div>
      {#if ps.factValues.length > 0}
        <div>
          <span class="text-text-muted font-semibold">Fact Values:</span>
          {#each ps.factValues as fv (fv.factId + fv.seatId)}
            <div class="pl-2">
              <span class="text-text-primary">{fv.factId}</span>
              <span class="text-text-muted ml-1">({fv.seatId})</span>
              <span class="text-cyan-300 ml-1">{fv.expectedValue.toFixed(3)}</span>
              <span class="text-text-muted ml-1">conf:{(fv.confidence * 100).toFixed(0)}%</span>
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      <div class="text-text-muted italic">No posterior data (not wired or no samples)</div>
    {/if}
  </div>
</details>
