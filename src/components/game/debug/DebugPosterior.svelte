<script lang="ts">
  import type { PosteriorSummary } from "../../../service";
  import DebugSection from "./DebugSection.svelte";

  interface Props {
    posteriorSummary: PosteriorSummary | null;
  }

  let { posteriorSummary }: Props = $props();

  /** Strip common prefix for compact display. */
  function shortName(factId: string): string {
    return factId.replace(/^bridge\./, "");
  }

  /** Color class based on mean value (0–1 probability range). */
  function probColor(value: number): string {
    if (value >= 0.7) return "text-green-400";
    if (value <= 0.3) return "text-red-400";
    return "text-yellow-400";
  }
</script>

<DebugSection
  title="Posterior"
  preview={posteriorSummary ? `${posteriorSummary.sampleCount} samples, ${(posteriorSummary.confidence * 100).toFixed(0)}% conf` : null}
>
  {#if posteriorSummary}
    {@const ps = posteriorSummary}
    <div class="text-[10px]">
      <span class="text-text-muted">samples:</span> <span class="text-text-primary">{ps.sampleCount}</span>
      <span class="text-text-muted ml-2">confidence:</span> <span class="text-text-primary">{(ps.confidence * 100).toFixed(1)}%</span>
    </div>
    {#if ps.factValues.length > 0}
      <DebugSection title="Fact Values" count={ps.factValues.length} nested>
        {#each ps.factValues as fv (fv.factId)}
          <div class="text-[10px] leading-tight">
            <span class="text-text-primary">{shortName(fv.factId)}</span>
            <span class="{probColor(fv.mean)} ml-0.5">mean:{fv.mean.toFixed(3)}</span>
            <span class="text-text-muted ml-0.5">sd:{fv.stdDev.toFixed(3)}</span>
            <span class="text-text-muted ml-0.5">[{fv.min.toFixed(2)}–{fv.max.toFixed(2)}]</span>
          </div>
        {/each}
      </DebugSection>
    {/if}
  {:else}
    <div class="text-text-muted italic text-[10px]">No posterior data</div>
  {/if}
</DebugSection>
