<script lang="ts">
  import type { BidHistoryEntry } from "../../service";
  import RoundBidList from "./RoundBidList.svelte";

  interface Props {
    bidHistory: readonly BidHistoryEntry[];
  }

  let { bidHistory }: Props = $props();
</script>

<div class="flex flex-col gap-3">
  <h3 class="text-[--text-value] font-semibold text-text-secondary">Bidding Review</h3>
  <RoundBidList {bidHistory} showExpectedResult />
</div>
