<script lang="ts">
  import type { Seat } from "../../../engine/types";
  import type { Card as CardType, Contract, Deal, PlayedCard, Suit, Trick } from "../../../engine/types";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import TrickArea from "../../game/TrickArea.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import PlaySidePanel from "./PlaySidePanel.svelte";
  import PlayHistoryPanel from "./PlayHistoryPanel.svelte";
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
    tricks: readonly Trick[];
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
    tricks,
    onPlayCard,
    onSkipToReview,
  }: Props = $props();

  // Use 3-column layout on desktop: [history] [table] [controls]
  const containerClass = $derived(
    phaseContainerClass.includes('grid-cols-')
      ? phaseContainerClass.replace(
          /grid-cols-\[1fr_var\(--width-side-panel\)\]/,
          'grid-cols-[var(--width-side-panel)_1fr_var(--width-side-panel)]'
        )
      : phaseContainerClass
  );
</script>

<div class={containerClass}>
  <aside class="{sidePanelClass} hidden lg:flex" aria-label="Play history">
    <PlayHistoryPanel {tricks} declarerSeat={contract?.declarer ?? null} />
  </aside>

  <ScaledTableArea scale={tableScale} origin={tableOrigin} tableWidth={tableBaseW} tableHeight={tableBaseH}>
    <BridgeTable
      hands={deal.hands}
      {faceUpSeats}
      vulnerability={deal.vulnerability}
      dealer={deal.dealer}
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
