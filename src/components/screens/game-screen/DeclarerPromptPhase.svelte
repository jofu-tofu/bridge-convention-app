<script lang="ts">
  import { Seat } from "../../../engine/types";
  import type { Contract, Deal } from "../../../engine/types";
  import type { Auction } from "../../../engine/types";
  import { getLayoutConfig } from "../../../stores/context";
  import { getAppStore } from "../../../stores/context";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";
  import DeclarerPrompt from "../../game/DeclarerPrompt.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";

  interface Props {
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
    deal,
    userSeat,
    faceUpSeats,
    auction,
    contract,
    promptMode,
    onAccept,
    onSkip,
  }: Props = $props();

  const layout = getLayoutConfig();
  const appStore = getAppStore();
</script>

<div class={layout.phaseContainerClass}>
  <ScaledTableArea scale={layout.tableScale} origin={layout.tableOrigin} tableWidth={layout.tableBaseW} tableHeight={layout.tableBaseH}>
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

  <aside class={layout.sidePanelClass} style="font-size: var(--panel-font, 1rem);" aria-label="Auction summary">
    <div
      class="bg-bg-card rounded-[--radius-lg] p-3 border border-border-subtle shadow-md"
    >
      <AuctionTable
        entries={auction.entries}
        dealer={deal.dealer}
        showEducationalAnnotations={appStore.displaySettings.showEducationalAnnotations}
        compact
      />
    </div>
  </aside>
</div>
