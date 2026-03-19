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
  import BiddingSettingsPanel from "./BiddingSettingsPanel.svelte";

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
    onNewDeal: () => void;
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
    onNewDeal,
  }: Props = $props();

  const layout = getLayoutConfig();

  // Use 3-column layout on desktop: [settings] [table] [bidding controls]
  // Settings panel uses the same side-panel width as the right panel;
  // GameScreen accounts for both when computing table scale.
  const containerClass = $derived(
    layout.phaseContainerClass.includes('grid-cols-')
      ? layout.phaseContainerClass.replace(
          /grid-cols-\[1fr_var\(--width-side-panel\)\]/,
          'grid-cols-[var(--width-side-panel)_minmax(0,1fr)_var(--width-side-panel)]'
        )
      : layout.phaseContainerClass
  );
</script>

<div class={containerClass}>
  <!-- Desktop: settings panel on the left -->
  <aside class="{layout.sidePanelClass} hidden lg:flex" style="font-size: var(--panel-font, 1rem);" aria-label="Practice settings">
    <BiddingSettingsPanel {onNewDeal} />
  </aside>

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
