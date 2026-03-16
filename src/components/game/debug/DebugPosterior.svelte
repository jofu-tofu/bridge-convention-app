<script lang="ts">
  import type { PosteriorSummary } from "../../../core/contracts";
  import type { PosteriorFactValue } from "../../../core/contracts/posterior";

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
    // Suit-parameterized facts: show readable suit name
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
            {@const condition = formatCondition(fv)}
            <div class="pl-2">
              <span class="text-text-primary">{shortName(fv.factId)}</span>
              <span class="text-text-muted ml-1">({fv.seatId})</span>
              {#if condition}
                <span class="text-violet-400 ml-1">{condition}</span>
              {/if}
              <span class="{probColor(fv.expectedValue)} ml-1">{(fv.expectedValue * 100).toFixed(1)}%</span>
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
