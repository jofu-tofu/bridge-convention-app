<script lang="ts">
  import type { Call, Deal, Seat } from "../../../engine/types";
  import type { Auction } from "../../../engine/types";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import BiddingSidePanel from "./BiddingSidePanel.svelte";
  import type { LayoutProps } from "./layout-props";

  interface Props extends LayoutProps {
    deal: Deal;
    faceUpSeats: ReadonlySet<Seat>;
    auction: Auction;
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
    deal,
    faceUpSeats,
    auction,
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
    <BridgeTable hands={deal.hands} {faceUpSeats}>
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
      {isFeedbackBlocking}
      {onRetry}
    />
  </aside>
</div>
