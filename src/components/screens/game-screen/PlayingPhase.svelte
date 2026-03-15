<script lang="ts">
  import type { Seat } from "../../../engine/types";
  import type { Card as CardType, Contract, Deal, PlayedCard, Suit } from "../../../engine/types";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import TrickArea from "../../game/TrickArea.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import PlaySidePanel from "./PlaySidePanel.svelte";
  import type { LayoutProps } from "./layout-props";

  interface Props extends LayoutProps {
    rotated: boolean;
    deal: Deal;
    contract: Contract | null;
    currentPlayer: Seat | null;
    faceUpSeats: ReadonlySet<Seat>;
    currentTrick: PlayedCard[];
    trumpSuit: Suit | undefined;
    declarerTricksWon: number;
    defenderTricksWon: number;
    legalPlays: readonly CardType[];
    userControlledSeats: readonly Seat[];
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
    rotated,
    deal,
    contract,
    currentPlayer,
    faceUpSeats,
    currentTrick,
    trumpSuit,
    declarerTricksWon,
    defenderTricksWon,
    legalPlays,
    userControlledSeats,
    remainingCards,
    onPlayCard,
    onSkipToReview,
  }: Props = $props();
</script>

<div class={phaseContainerClass}>
  <ScaledTableArea scale={tableScale} origin={tableOrigin} tableWidth={tableBaseW} tableHeight={tableBaseH}>
    <BridgeTable
      hands={deal.hands}
      {faceUpSeats}
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
