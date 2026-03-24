<script lang="ts">
  import type { Seat } from "../../../service";
  import type { Card as CardType } from "../../../service";
  import type { PlayingViewport } from "../../../service";
  import { getLayoutConfig } from "../../../stores/context";
  import { PLAYING_PHASE_CONTAINER_CLASS, SIDE_PANEL_CLASS } from "../../shared/layout-props";
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
</script>

<div class={PLAYING_PHASE_CONTAINER_CLASS}>
  <!-- Desktop: dedicated left panel for trick history -->
  <aside class="hidden lg:flex lg:flex-col lg:h-full bg-bg-base p-3 min-h-0 overflow-hidden" style="font-size: var(--panel-font, 1rem);" aria-label="Play history">
    <PlayHistoryPanel tricks={viewport.tricks} declarerSeat={viewport.contract?.declarer ?? null} auctionEntries={viewport.auctionEntries} dealer={viewport.dealer} bidHistory={viewport.bidHistory} />
  </aside>

  <ScaledTableArea scale={layout.tableScale} origin={layout.tableOrigin} tableWidth={layout.tableBaseW} tableHeight={layout.tableBaseH}>
    <BridgeTable
      visibleHands={viewport.visibleHands}
      vulnerability={viewport.vulnerability}
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
        rotated={viewport.rotated}
      />
    </BridgeTable>
  </ScaledTableArea>

  <aside class="{SIDE_PANEL_CLASS}" style="font-size: var(--panel-font, 1rem);" aria-label="Play controls">
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
