<script lang="ts">
  import type { ExplanationViewport } from "../../../service";
  import { getLayoutConfig } from "../../../stores/context";
  import { PHASE_CONTAINER_CLASS, PANEL_FONT_STYLE, SIDE_PANEL_CLASS } from "../../shared/layout-props";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";
  import BidAnnotationPopup from "../../game/BidAnnotationPopup.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import LearnSidePanel from "./LearnSidePanel.svelte";

  interface Props {
    viewport: ExplanationViewport;
    dealNumber: number;
    onNextDeal: () => void;
    onBackToMenu: () => void;
  }

  const { viewport, dealNumber, onNextDeal, onBackToMenu }: Props = $props();

  const layout = getLayoutConfig();

  let currentBidIndex = $state(0);

  const totalBids = $derived(viewport.bidHistory.length);
  const steppedEntries = $derived(viewport.auctionEntries.slice(0, currentBidIndex));
  const currentEntry = $derived(currentBidIndex > 0 ? viewport.auctionEntries[currentBidIndex - 1] : null);
  const currentHistoryEntry = $derived(currentBidIndex > 0 ? viewport.bidHistory[currentBidIndex - 1] : null);

  // Reset on new deal
  $effect(() => {
    void dealNumber;
    currentBidIndex = 0;
  });

  function goFirst() { currentBidIndex = 0; }
  function goPrev() { if (currentBidIndex > 0) currentBidIndex--; }
  function goNext() { if (currentBidIndex < totalBids) currentBidIndex++; }
  function goLast() { currentBidIndex = totalBids; }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      goNext();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    } else if (e.key === "Home") {
      e.preventDefault();
      goFirst();
    } else if (e.key === "End") {
      e.preventDefault();
      goLast();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class={PHASE_CONTAINER_CLASS}>
  <div class="flex flex-col min-h-0 flex-1">
    <ScaledTableArea
      scale={layout.tableScale}
      origin={layout.tableOrigin}
      tableWidth={layout.tableBaseW}
      tableHeight={layout.tableBaseH}
    >
      <BridgeTable visibleHands={viewport.allHands} vulnerability={viewport.vulnerability}>
        <div class="flex flex-col items-center gap-2">
          <div class="relative bg-bg-card border-border-subtle rounded-[--radius-lg] border p-3 shadow-md">
            <AuctionTable
              entries={steppedEntries}
              dealer={viewport.dealer}
              compact
            />
          </div>
          {#if currentEntry && currentHistoryEntry}
            {#key currentBidIndex}
              <BidAnnotationPopup entry={currentEntry} historyEntry={currentHistoryEntry} />
            {/key}
          {:else if currentBidIndex === 0}
            <p class="text-[--text-body] text-text-muted italic">Press Next to step through the auction</p>
          {/if}
        </div>
      </BridgeTable>
    </ScaledTableArea>
  </div>

  <aside class={SIDE_PANEL_CLASS} style={PANEL_FONT_STYLE} aria-label="Learn controls">
    <LearnSidePanel
      {currentBidIndex}
      {totalBids}
      onFirst={goFirst}
      onPrev={goPrev}
      onNext={goNext}
      onLast={goLast}
      {onNextDeal}
      {onBackToMenu}
    />
  </aside>
</div>
