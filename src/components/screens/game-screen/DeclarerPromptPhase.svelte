<script lang="ts">
  import { Seat } from "../../../engine/types";
  import type { Contract, Deal } from "../../../engine/types";
  import { partnerSeat } from "../../../engine/constants";
  import type { Auction } from "../../../engine/types";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";
  import DeclarerPrompt from "../../game/DeclarerPrompt.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import type { LayoutProps } from "./layout-props";

  interface Props extends LayoutProps {
    deal: Deal;
    userSeat: Seat;
    auction: Auction;
    contract: Contract;
    isDefenderPrompt: boolean;
    isSouthDeclarerPrompt: boolean;
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
    auction,
    contract,
    isDefenderPrompt,
    isSouthDeclarerPrompt,
    onAccept,
    onSkip,
  }: Props = $props();

  const dummySeat = $derived(
    isDefenderPrompt
      ? partnerSeat(contract.declarer)
      : isSouthDeclarerPrompt
        ? partnerSeat(contract.declarer)
        : contract.declarer,
  );

  const promptMode = $derived(
    isDefenderPrompt
      ? ("defender" as const)
      : isSouthDeclarerPrompt
        ? ("south-declarer" as const)
        : ("declarer-swap" as const),
  );
</script>

<div class={phaseContainerClass}>
  <ScaledTableArea scale={tableScale} origin={tableOrigin} tableWidth={tableBaseW} tableHeight={tableBaseH}>
    <BridgeTable
      hands={deal.hands}
      {userSeat}
      {dummySeat}
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

  <aside class={sidePanelClass} aria-label="Auction summary">
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
