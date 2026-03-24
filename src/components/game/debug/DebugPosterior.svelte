<script lang="ts">
  import type { PosteriorSummary } from "../../../service";
  import type { PosteriorFactValue } from "../../../service";
  import DebugSection from "./DebugSection.svelte";

  interface Props {
    posteriorSummary: PosteriorSummary | null;
  }

  let { posteriorSummary }: Props = $props();

  /** Strip common prefix for compact display. */
  function shortName(factId: string): string {
    return factId.replace(/^bridge\./, "");
  }

  const SUIT_LABELS: Record<string, string> = { H: "Hearts", S: "Spades", D: "Diamonds", C: "Clubs" };

  /** Format conditionedOn for display. */
  function formatCondition(fv: PosteriorFactValue): string {
    if (!fv.conditionedOn || fv.conditionedOn.length === 0) return "";
    if (fv.factId === "bridge.combinedHcpInRangeLikely") {
      return `[${fv.conditionedOn[0]}–${fv.conditionedOn[1]} HCP]`;
    }
    if (fv.conditionedOn.length === 1 && SUIT_LABELS[fv.conditionedOn[0]!]) {
      return `[${SUIT_LABELS[fv.conditionedOn[0]!]}]`;
    }
    return `[${fv.conditionedOn.join(", ")}]`;
  }

  /** Color class based on probability value. */
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
        {#each ps.factValues as fv (fv.factId + fv.seatId)}
          {@const condition = formatCondition(fv)}
          <div class="text-[10px] leading-tight">
            <span class="text-text-primary">{shortName(fv.factId)}</span>
            <span class="text-text-muted ml-0.5">({fv.seatId})</span>
            {#if condition}
              <span class="text-violet-400 ml-0.5">{condition}</span>
            {/if}
            <span class="{probColor(fv.expectedValue)} ml-0.5">{(fv.expectedValue * 100).toFixed(1)}%</span>
            <span class="text-text-muted ml-0.5">conf:{(fv.confidence * 100).toFixed(0)}%</span>
          </div>
        {/each}
      </DebugSection>
    {/if}
  {:else}
    <div class="text-text-muted italic text-[10px]">No posterior data</div>
  {/if}
</DebugSection>
