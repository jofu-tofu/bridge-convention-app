<script lang="ts">
  import { Seat } from "../../../engine/types";
  import type { Card as CardType, Contract, Deal, PlayedCard, Suit } from "../../../engine/types";
  import { partnerSeat } from "../../../engine/constants";
  import { seatController } from "../../../stores/game.svelte";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import TrickArea from "../../game/TrickArea.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import PlaySidePanel from "./PlaySidePanel.svelte";
  import type { LayoutProps } from "./layout-props";

  interface Props extends LayoutProps {
    playUserSeat: Seat;
    rotated: boolean;
    deal: Deal;
    contract: Contract | null;
    currentPlayer: Seat | null;
    dummySeat: Seat | undefined;
    currentTrick: PlayedCard[];
    trumpSuit: Suit | undefined;
    declarerTricksWon: number;
    defenderTricksWon: number;
    legalPlays: CardType[];
    remainingCards: Partial<Record<Seat, readonly CardType[]>> | undefined;
    onPlayCard: (card: CardType, seat: Seat) => void;
    onSkipToReview: () => void;
  }

  const {
    tableScale,
    tableOrigin,
    tableBaseW,
    tableBaseH,
    phaseContainerClass,
    sidePanelClass,
    playUserSeat,
    rotated,
    deal,
    contract,
    currentPlayer,
    dummySeat,
    currentTrick,
    trumpSuit,
    declarerTricksWon,
    defenderTricksWon,
    legalPlays,
    remainingCards,
    onPlayCard,
    onSkipToReview,
  }: Props = $props();

  // Compute user-controlled seats for play phase
  const userControlledSeats = $derived.by(() => {
    if (!contract) return [playUserSeat];
    const seats: Seat[] = [playUserSeat];
    const dummy = partnerSeat(contract.declarer);
    if (
      seatController(dummy, contract.declarer, playUserSeat) ===
      "user"
    ) {
      seats.push(dummy);
    }
    return seats;
  });
</script>

<div class={phaseContainerClass}>
  <ScaledTableArea scale={tableScale} origin={tableOrigin} tableWidth={tableBaseW} tableHeight={tableBaseH}>
    <BridgeTable
      hands={deal.hands}
      userSeat={playUserSeat}
      {dummySeat}
      legalPlays={legalPlays}
      onPlayCard={onPlayCard}
      currentPlayer={currentPlayer ?? undefined}
      {userControlledSeats}
      {remainingCards}
      {rotated}
    >
      <TrickArea
        {currentTrick}
        {currentPlayer}
        {trumpSuit}
        {rotated}
      />
    </BridgeTable>
  </ScaledTableArea>

  <aside class={sidePanelClass} aria-label="Play controls">
    <PlaySidePanel
      {contract}
      {declarerTricksWon}
      {defenderTricksWon}
      {onSkipToReview}
    />
  </aside>
</div>
