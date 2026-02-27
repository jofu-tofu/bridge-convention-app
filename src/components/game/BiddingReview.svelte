<script lang="ts">
  import type { BidHistoryEntry } from "../../shared/types";
  import RoundBidList from "./RoundBidList.svelte";

  interface Props {
    bidHistory: BidHistoryEntry[];
  }

  let { bidHistory }: Props = $props();
</script>

<div class="flex flex-col gap-3">
  <h3 class="text-lg font-semibold text-text-secondary">Bidding Review</h3>
  <RoundBidList {bidHistory} defaultSiblingsExpanded showExpectedResult />
</div>
