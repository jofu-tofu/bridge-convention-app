<script lang="ts">
  import type { Seat } from "../../../engine/types";
  import type { Card as CardType } from "../../../engine/types";
  import type { PlayingViewport } from "../../../core/viewport";
  import { getLayoutConfig } from "../../../stores/context";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import TrickArea from "../../game/TrickArea.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import PlaySidePanel from "./PlaySidePanel.svelte";
  import PlayHistoryPanel from "./PlayHistoryPanel.svelte";

  interface Props {
    viewport: PlayingViewport;
    onPlayCard: (card: CardType, seat: Seat) => void;
    onSkipToReview: () => void;
  }

  const {
    viewport,
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
    <PlayHistoryPanel tricks={viewport.tricks} declarerSeat={viewport.contract?.declarer ?? null} auctionEntries={viewport.auctionEntries} dealer={viewport.dealer} bidHistory={viewport.bidHistory} />
  </aside>

  <ScaledTableArea scale={layout.tableScale} origin={layout.tableOrigin} tableWidth={layout.tableBaseW} tableHeight={layout.tableBaseH}>
    <BridgeTable
      visibleHands={viewport.visibleHands}
      vulnerability={viewport.vulnerability}
      dealer={viewport.dealer}
      legalPlays={viewport.legalPlays}
      {onPlayCard}
      currentPlayer={viewport.currentPlayer ?? undefined}
      userControlledSeats={viewport.userControlledSeats}
      remainingCards={viewport.remainingCards}
      rotated={viewport.rotated}
    >
      <TrickArea
        currentTrick={viewport.currentTrick}
        currentPlayer={viewport.currentPlayer}
        trumpSuit={viewport.trumpSuit}
        rotated={viewport.rotated}
      />
    </BridgeTable>
  </ScaledTableArea>

  <aside class={layout.sidePanelClass} style="font-size: var(--panel-font, 1rem);" aria-label="Play controls">
    <!-- Mobile/tablet: trick history above controls (hidden on desktop where left panel shows it) -->
    <div class="lg:hidden max-h-48 min-h-0 overflow-hidden mb-2">
      <PlayHistoryPanel tricks={viewport.tricks} declarerSeat={viewport.contract?.declarer ?? null} auctionEntries={viewport.auctionEntries} dealer={viewport.dealer} bidHistory={viewport.bidHistory} />
    </div>
    <PlaySidePanel
      contract={viewport.contract}
      declarerTricksWon={viewport.declarerTricksWon}
      defenderTricksWon={viewport.defenderTricksWon}
      {onSkipToReview}
    />
  </aside>
</div>
