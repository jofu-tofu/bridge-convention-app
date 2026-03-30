<script lang="ts">
  import type { BidResult } from "../../../service";
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
    </div>
  {:else}
    <span class="text-yellow-300/50 italic text-[10px]">No convention bid (pass)</span>
  {/if}
</DebugSection>
