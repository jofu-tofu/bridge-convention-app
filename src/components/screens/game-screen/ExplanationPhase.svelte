<script lang="ts">
  import { Seat } from "../../../engine/types";
  import type { ExplanationViewport } from "../../../core/viewport";
  import type { ConventionConfig } from "../../../core/contracts/convention";
  import { getLayoutConfig } from "../../../stores/context";
  import { getAppStore } from "../../../stores/context";
  import { PHASE_CONTAINER_CLASS, SIDE_PANEL_CLASS } from "../../../core/display/layout-props";
  import type { DDSAnalysisProps } from "./shared-props";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";
  import HandFan from "../../game/HandFan.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import ReviewSidePanel from "./ReviewSidePanel.svelte";

  interface Props extends DDSAnalysisProps {
    viewport: ExplanationViewport;
    dealNumber: number;
    onNextDeal: () => void;
    onBackToMenu: () => void;
    onPlayHand?: (() => void) | undefined;
    convention?: ConventionConfig | undefined;
  }

  const {
    viewport,
    ddsSolution,
    ddsSolving,
    ddsError,
    dealNumber,
    onNextDeal,
    onBackToMenu,
    onPlayHand,
    convention,
  }: Props = $props();

  const layout = getLayoutConfig();
  const appStore = getAppStore();

  let showAllCards = $state(false);
</script>

<div class={PHASE_CONTAINER_CLASS}>
  {#if showAllCards}
    <div class="flex min-w-0 flex-1 flex-col gap-3 overflow-auto p-4">
      <div class="flex items-center justify-between">
        <div
          class="bg-bg-card border-border-subtle rounded-[--radius-lg] border p-2 shadow-md"
        >
          <AuctionTable
            entries={viewport.auctionEntries}
            dealer={viewport.dealer}
            bidHistory={viewport.bidHistory}
            showEducationalAnnotations={appStore.displaySettings.showEducationalAnnotations}
            compact
          />
        </div>
        <button
          type="button"
          class="text-text-primary hover:text-accent-primary border-border-subtle bg-bg-card/80 min-h-[--size-touch-target] shrink-0 rounded-[--radius-md] border px-3 py-2 text-[--text-detail] transition-colors"
          onclick={() => (showAllCards = !showAllCards)}
          aria-expanded={showAllCards}
          aria-label="Toggle all hands visibility"
        >
          Hide Hands
        </button>
      </div>
      <div class="grid grid-cols-2 gap-3" style="--card-overlap-h: -38px;">
        {#each [Seat.North, Seat.East, Seat.South, Seat.West] as seat (seat)}
          <section
            class="bg-bg-card border-border-subtle rounded-[--radius-lg] border p-3"
            aria-label="{seat} hand"
          >
            <div class="mb-2 flex items-center gap-2">
              <span
                class="rounded px-2 py-0.5 text-[--text-detail] font-bold tracking-wide {seat ===
                viewport.userSeat
                  ? 'bg-accent-primary-subtle text-accent-primary'
                  : 'bg-bg-elevated text-text-primary'}"
              >
                {seat}
              </span>
            </div>
            <HandFan cards={viewport.allHands[seat].cards} faceUp />
          </section>
        {/each}
      </div>
    </div>
  {:else}
    <ScaledTableArea
      scale={layout.tableScale}
      origin={layout.tableOrigin}
      tableWidth={layout.tableBaseW}
      tableHeight={layout.tableBaseH}
    >
      <BridgeTable visibleHands={viewport.allHands} vulnerability={viewport.vulnerability}>
        <div class="flex flex-col items-center gap-2">
          <div
            class="bg-bg-card border-border-subtle rounded-[--radius-lg] border p-3 shadow-md"
          >
            <AuctionTable
              entries={viewport.auctionEntries}
              dealer={viewport.dealer}
              bidHistory={viewport.bidHistory}
              showEducationalAnnotations={appStore.displaySettings.showEducationalAnnotations}
              compact
            />
          </div>
          <button
            type="button"
            class="text-text-primary hover:text-accent-primary border-border-subtle bg-bg-card/80 min-h-[--size-touch-target] rounded-[--radius-md] border px-3 py-2 text-[--text-detail] transition-colors"
            onclick={() => (showAllCards = !showAllCards)}
            aria-expanded={showAllCards}
            aria-label="Toggle all hands visibility"
          >
            Show All Hands
          </button>
        </div>
      </BridgeTable>
    </ScaledTableArea>
  {/if}

  <aside class="{SIDE_PANEL_CLASS}" style="font-size: var(--panel-font, 1rem);" aria-label="Review panel">
    <ReviewSidePanel
      contract={viewport.contract}
      score={viewport.score}
      declarerTricksWon={viewport.declarerTricksWon}
      bidHistory={viewport.bidHistory}
      {ddsSolution}
      {ddsSolving}
      {ddsError}
      vulnerability={viewport.vulnerability}
      {dealNumber}
      {onNextDeal}
      {onBackToMenu}
      {onPlayHand}
    />
  </aside>
</div>
