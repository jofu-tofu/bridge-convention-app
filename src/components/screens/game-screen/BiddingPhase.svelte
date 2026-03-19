<script lang="ts">
  import type { Call } from "../../../engine/types";
  import type { Auction } from "../../../engine/types";
  import type { BidHistoryEntry } from "../../../core/contracts";
  import type { BiddingViewport } from "../../../core/viewport";
  import type { ViewportBidFeedback, TeachingDetail } from "../../../core/viewport";
  import { getLayoutConfig } from "../../../stores/context";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import BiddingSidePanel from "./BiddingSidePanel.svelte";

  interface Props {
    viewport: BiddingViewport;
    auction: Auction;
    bidHistory?: readonly BidHistoryEntry[];
    legalCalls: Call[];
    onBid: (call: Call) => void;
    disabled: boolean;
    isUserTurn: boolean;
    isFeedbackBlocking: boolean;
    onRetry: () => void;
    viewportFeedback: ViewportBidFeedback | null;
    teachingDetail: TeachingDetail | null;
  }

  const {
    viewport,
    auction,
    bidHistory,
    legalCalls,
    onBid,
    disabled,
    isUserTurn,
    isFeedbackBlocking,
    onRetry,
    viewportFeedback,
    teachingDetail,
  }: Props = $props();

  const layout = getLayoutConfig();
</script>

<div class={layout.phaseContainerClass}>
  <ScaledTableArea scale={layout.tableScale} origin={layout.tableOrigin} tableWidth={layout.tableBaseW} tableHeight={layout.tableBaseH}>
    <BridgeTable visibleHands={viewport.visibleHands} vulnerability={viewport.vulnerability} dealer={viewport.dealer}>
      <div
        class="bg-bg-card rounded-[--radius-lg] p-3 border border-border-subtle shadow-md"
      >
        <AuctionTable
          entries={auction.entries}
          dealer={viewport.dealer}
          {bidHistory}
          compact
        />
      </div>
    </BridgeTable>
  </ScaledTableArea>

  <aside class={layout.sidePanelClass} style="font-size: var(--panel-font, 1rem);" aria-label="Bidding controls">
    <BiddingSidePanel
      {legalCalls}
      {onBid}
      {disabled}
      {isUserTurn}
      {isFeedbackBlocking}
      {onRetry}
      {viewportFeedback}
      {teachingDetail}
    />
  </aside>
</div>
