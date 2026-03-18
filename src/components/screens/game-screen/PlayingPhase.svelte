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

  // Use 3-column layout on desktop: [compact history] [table] [controls]
  // History panel uses the same side-panel width as the right panel;
  // GameScreen accounts for both when computing table scale.
  const containerClass = $derived(
    phaseContainerClass.includes('grid-cols-')
      ? phaseContainerClass.replace(
          /grid-cols-\[1fr_var\(--width-side-panel\)\]/,
          'grid-cols-[var(--width-side-panel)_minmax(0,1fr)_var(--width-side-panel)]'
        )
      : phaseContainerClass
  );
</script>

<div class={containerClass}>
  <!-- Desktop: dedicated left panel for trick history -->
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
    <!-- Mobile/tablet: trick history above controls (hidden on desktop where left panel shows it) -->
    <div class="lg:hidden max-h-48 min-h-0 overflow-hidden mb-2">
      <PlayHistoryPanel {tricks} declarerSeat={contract?.declarer ?? null} />
    </div>
    <PlaySidePanel
      {contract}
      {declarerTricksWon}
      {defenderTricksWon}
      {onSkipToReview}
    />
  </aside>
</div>
