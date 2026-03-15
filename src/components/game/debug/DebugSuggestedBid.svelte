<script lang="ts">
  import type { BidResult } from "../../../core/contracts";
  import { fmtCall } from "./debug-helpers";

  interface Props {
    expectedBid: BidResult | null;
  }

  let { expectedBid }: Props = $props();
</script>

<details open>
  <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">Suggested Bid</summary>
  <div class="pl-2 py-1 flex flex-col gap-1">
    {#if expectedBid}
      {@const bid = expectedBid}
      <div class="flex items-baseline gap-2">
        <span class="text-lg font-bold text-green-300">{fmtCall(bid.call)}</span>
        {#if bid.meaning}
          <span class="text-yellow-300">{bid.meaning}</span>
        {/if}
      </div>
      <div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <span class="text-text-muted">rule</span>
        <span class="text-text-primary">{bid.ruleName ?? "—"}</span>
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
      <span class="text-yellow-300/50 italic">No convention bid (pass)</span>
    {/if}
  </div>
</details>
