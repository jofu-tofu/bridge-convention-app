<script lang="ts">
  import type { BidResult } from "../../../core/contracts";
  import { fmtCall } from "./debug-helpers";
  import DebugSection from "./DebugSection.svelte";

  interface Props {
    expectedBid: BidResult | null;
  }

  let { expectedBid }: Props = $props();
</script>

<DebugSection
  title="Suggested Bid"
  badge={expectedBid ? fmtCall(expectedBid.call) : "Pass"}
  badgeColor={expectedBid ? "bg-green-900/50 text-green-300" : "bg-yellow-900/50 text-yellow-300"}
  preview={expectedBid?.meaning ?? null}
  open
>
  {#if expectedBid}
    {@const bid = expectedBid}
    <div class="text-[10px] grid grid-cols-[auto_1fr] gap-x-2 gap-y-0">
      <span class="text-text-muted">rule</span>
      <span class="text-text-primary">{bid.ruleName ?? "\u2014"}</span>
      <span class="text-text-muted">explanation</span>
      <span class="text-text-primary">{bid.explanation}</span>
      {#if bid.handSummary}
        <span class="text-text-muted">hand</span>
        <span class="text-text-primary">{bid.handSummary}</span>
      {/if}
      {#if bid.evaluationTrace}
        <span class="text-text-muted">convention</span>
        <span class="text-text-primary">{bid.evaluationTrace.conventionId}</span>
        <span class="text-text-muted">candidates</span>
        <span class="text-text-primary">{bid.evaluationTrace.candidateCount}</span>
        {#if bid.evaluationTrace.posteriorSampleCount}
          <span class="text-text-muted">posterior</span>
          <span class="text-text-primary">{bid.evaluationTrace.posteriorSampleCount} samples, {((bid.evaluationTrace.posteriorConfidence ?? 0) * 100).toFixed(0)}% conf</span>
        {/if}
      {/if}
    </div>
  {:else}
    <span class="text-yellow-300/50 italic text-[10px]">No convention bid (pass)</span>
  {/if}
</DebugSection>
