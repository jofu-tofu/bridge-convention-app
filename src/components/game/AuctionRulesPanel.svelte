<script lang="ts">
  import type { BidHistoryEntry } from "../../shared/types";
  import RoundBidList from "./RoundBidList.svelte";

  interface Props {
    bidHistory: BidHistoryEntry[];
  }

  const { bidHistory }: Props = $props();
</script>

<div class="flex flex-col gap-3 overflow-hidden">
  <div class="flex flex-col gap-1">
    <h2 class="text-text-primary text-base font-semibold">Auction Rules</h2>
    <p class="text-text-muted text-xs">
      Round-by-round view of convention rules applied during this auction
    </p>
  </div>

  <RoundBidList {bidHistory} testIdPrefix="auction-rules" />
</div>
