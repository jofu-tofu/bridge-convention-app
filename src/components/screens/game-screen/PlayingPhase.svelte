<script lang="ts">
  import type { Seat } from "../../../engine/types";
  import type { Card as CardType, Contract, Deal, PlayedCard, Suit, Trick, Auction } from "../../../engine/types";
  import type { BidHistoryEntry } from "../../../core/contracts";
  import { getLayoutConfig } from "../../../stores/context";
  import type { TrickScoreProps } from "./shared-props";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import TrickArea from "../../game/TrickArea.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import PlaySidePanel from "./PlaySidePanel.svelte";
  import PlayHistoryPanel from "./PlayHistoryPanel.svelte";

  interface Props extends TrickScoreProps {
    rotated: boolean;
    deal: Deal;
    contract: Contract | null;
    currentPlayer: Seat | null;
    faceUpSeats: ReadonlySet<Seat>;
    currentTrick: PlayedCard[];
    trumpSuit: Suit | undefined;
    legalPlays: readonly CardType[];
    userControlledSeats: readonly Seat[];
    remainingCards: Partial<Record<Seat, readonly CardType[]>> | undefined;
    tricks: readonly Trick[];
    auction?: Auction;
    bidHistory?: readonly BidHistoryEntry[];
    onPlayCard: (card: CardType, seat: Seat) => void;
    onSkipToReview: () => void;
  }

  const {
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
    auction,
    bidHistory,
    onPlayCard,
    onSkipToReview,
  }: Props = $props();

  const layout = getLayoutConfig();

  // Use 3-column layout on desktop: [compact history] [table] [controls]
  // History panel uses the same side-panel width as the right panel;
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
  <!-- Desktop: dedicated left panel for trick history -->
  <aside class="{layout.sidePanelClass} hidden lg:flex" style="font-size: var(--panel-font, 1rem);" aria-label="Play history">
    <PlayHistoryPanel {tricks} declarerSeat={contract?.declarer ?? null} {auction} dealer={deal.dealer} {bidHistory} />
  </aside>

  <ScaledTableArea scale={layout.tableScale} origin={layout.tableOrigin} tableWidth={layout.tableBaseW} tableHeight={layout.tableBaseH}>
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

  <aside class={layout.sidePanelClass} style="font-size: var(--panel-font, 1rem);" aria-label="Play controls">
    <!-- Mobile/tablet: trick history above controls (hidden on desktop where left panel shows it) -->
    <div class="lg:hidden max-h-48 min-h-0 overflow-hidden mb-2">
      <PlayHistoryPanel {tricks} declarerSeat={contract?.declarer ?? null} {auction} dealer={deal.dealer} {bidHistory} />
    </div>
    <PlaySidePanel
      {contract}
      {declarerTricksWon}
      {defenderTricksWon}
      {onSkipToReview}
    />
  </aside>
</div>
