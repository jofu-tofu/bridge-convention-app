<script lang="ts">
  import { Seat } from "../../../engine/types";
  import type { Call, Deal } from "../../../engine/types";
  import type { Auction } from "../../../engine/types";
  import type { BidFeedback } from "../../../stores/game.svelte";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import BiddingSidePanel from "./BiddingSidePanel.svelte";
  import type { LayoutProps } from "./layout-props";

  interface Props extends LayoutProps {
    deal: Deal;
    userSeat: Seat;
    auction: Auction;
    legalCalls: Call[];
    onBid: (call: Call) => void;
    disabled: boolean;
    isUserTurn: boolean;
    bidFeedback: BidFeedback | null;
    isFeedbackBlocking: boolean;
    onDismissFeedback: () => void;
    onSkipToReview: () => void;
    onRetry: () => void;
  }

  const {
    tableScale,
    tableOrigin,
    tableBaseW,
    tableBaseH,
    phaseContainerClass,
    sidePanelClass,
    deal,
    userSeat,
    auction,
    legalCalls,
    onBid,
    disabled,
    isUserTurn,
    bidFeedback,
    isFeedbackBlocking,
    onDismissFeedback,
    onSkipToReview,
    onRetry,
  }: Props = $props();
</script>

<div class={phaseContainerClass}>
  <ScaledTableArea scale={tableScale} origin={tableOrigin} tableWidth={tableBaseW} tableHeight={tableBaseH}>
    <BridgeTable hands={deal.hands} {userSeat}>
      <div
        class="bg-bg-card rounded-[--radius-lg] p-3 border border-border-subtle shadow-md"
      >
        <AuctionTable
          entries={auction.entries}
          dealer={deal.dealer}
          compact
        />
      </div>
    </BridgeTable>
  </ScaledTableArea>

  <aside class={sidePanelClass} aria-label="Bidding controls">
    <BiddingSidePanel
      {legalCalls}
      {onBid}
      {disabled}
      {isUserTurn}
      {bidFeedback}
      {isFeedbackBlocking}
      {onDismissFeedback}
      {onSkipToReview}
      {onRetry}
    />
  </aside>
</div>
