<script lang="ts">
  import type { Call } from "../../../engine/types";
  import type { Auction } from "../../../engine/types";
  import type { BidHistoryEntry } from "../../../core/contracts";
  import type { BiddingViewport } from "../../../core/viewport";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import BiddingSidePanel from "./BiddingSidePanel.svelte";
  import type { LayoutProps } from "./layout-props";

  interface Props extends LayoutProps {
    viewport: BiddingViewport;
    auction: Auction;
    bidHistory?: readonly BidHistoryEntry[];
    legalCalls: Call[];
    onBid: (call: Call) => void;
    disabled: boolean;
    isUserTurn: boolean;
    isFeedbackBlocking: boolean;
    onRetry: () => void;
  }

  const {
    tableScale,
    tableOrigin,
    tableBaseW,
    tableBaseH,
    phaseContainerClass,
    sidePanelClass,
    viewport,
    auction,
    bidHistory,
    legalCalls,
    onBid,
    disabled,
    isUserTurn,
    isFeedbackBlocking,
    onRetry,
  }: Props = $props();
</script>

<div class={phaseContainerClass}>
  <ScaledTableArea scale={tableScale} origin={tableOrigin} tableWidth={tableBaseW} tableHeight={tableBaseH}>
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

  <aside class={sidePanelClass} style="font-size: var(--panel-font, 1rem);" aria-label="Bidding controls">
    <BiddingSidePanel
      {legalCalls}
      {onBid}
      {disabled}
      {isUserTurn}
      {isFeedbackBlocking}
      {onRetry}
    />
  </aside>
</div>
