<script lang="ts">
  import { Seat } from "../../../engine/types";
  import type { Contract, Deal } from "../../../engine/types";
  import type { Auction } from "../../../engine/types";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";
  import DeclarerPrompt from "../../game/DeclarerPrompt.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import type { LayoutProps } from "./layout-props";

  interface Props extends LayoutProps {
    deal: Deal;
    userSeat: Seat;
    faceUpSeats: ReadonlySet<Seat>;
    auction: Auction;
    contract: Contract;
    promptMode: "defender" | "south-declarer" | "declarer-swap";
    onAccept: () => void;
    onSkip: () => void;
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
    faceUpSeats,
    auction,
    contract,
    promptMode,
    onAccept,
    onSkip,
  }: Props = $props();
</script>

<div class={phaseContainerClass}>
  <ScaledTableArea scale={tableScale} origin={tableOrigin} tableWidth={tableBaseW} tableHeight={tableBaseH}>
    <BridgeTable
      hands={deal.hands}
      {faceUpSeats}
      vulnerability={deal.vulnerability}
      dealer={deal.dealer}
    >
      <DeclarerPrompt
        {contract}
        {userSeat}
        mode={promptMode}
        {onAccept}
        {onSkip}
      />
    </BridgeTable>
  </ScaledTableArea>

  <aside class={sidePanelClass} style="font-size: var(--panel-font, 1rem);" aria-label="Auction summary">
    <div
      class="bg-bg-card rounded-[--radius-lg] p-3 border border-border-subtle shadow-md"
    >
      <AuctionTable
        entries={auction.entries}
        dealer={deal.dealer}
        compact
      />
    </div>
  </aside>
</div>
