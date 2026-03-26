<script lang="ts">
  import { Seat, Suit, BidSuit } from "../../../service";
  import type { ExplanationViewport } from "../../../service";
  import type { ConventionConfig } from "../../../service";
  import { getLayoutConfig } from "../../../stores/context";
  import { getAppStore } from "../../../stores/context";
  import { PHASE_CONTAINER_CLASS, REVIEW_PHASE_CONTAINER_CLASS, SIDE_PANEL_CLASS } from "../../shared/layout-props";
  import type { DDSAnalysisProps } from "./shared-props";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";
  import TrickOverlay from "../../game/TrickOverlay.svelte";
  import HandFan from "../../game/HandFan.svelte";
  import ReplayControls from "../../game/ReplayControls.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import PlayHistoryPanel from "./PlayHistoryPanel.svelte";
  import ReviewSidePanel from "./ReviewSidePanel.svelte";
  import SettingsDialog from "./SettingsDialog.svelte";
  import {
    totalSteps,
    positionAtStep,
    stepAtPosition,
    visibleTricksAtPosition,
    isDecisionPoint,
    findNextDecision,
  } from "../../game/replay-state";
  import { computeVisibleSeats } from "../../game/AuctionStepPanel";

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
    convention: _convention,
  }: Props = $props();

  const layout = getLayoutConfig();
  const appStore = getAppStore();

  let showAllCards = $state(false);
  let settingsDialogRef = $state<ReturnType<typeof SettingsDialog>>();

  // Auction step-through state
  let selectedBidStep = $state<number | null>(null);
  const totalBids = $derived(viewport.bidHistory.length);

  function handleSelectBidStep(step: number | null) {
    selectedBidStep = step;
    // Clear replay step when entering bid stepping (they share the table)
    if (step !== null) replayStep = 0;
  }

  // Derived: sliced auction entries for table display
  const steppedAuctionEntries = $derived(
    selectedBidStep === null
      ? viewport.auctionEntries
      : viewport.auctionEntries.slice(0, selectedBidStep),
  );

  // Derived: visible hands based on bid step
  const steppedVisibleHands = $derived(
    computeVisibleSeats(viewport.allHands, viewport.userSeat, viewport.bidHistory, selectedBidStep),
  );

  // Replay state — single source of truth for card-by-card stepping
  let replayStep = $state(0);
  const hasPlayData = $derived(viewport.tricks.length > 0 && viewport.contract !== null);
  const maxSteps = $derived(totalSteps(viewport.tricks));
  const replayPos = $derived(positionAtStep(replayStep, viewport.tricks));
  const replayVis = $derived(visibleTricksAtPosition(replayPos));
  const currentDecision = $derived(
    isDecisionPoint(replayPos, viewport.playRecommendations, viewport.userSeat),
  );
  const hasNextDecision = $derived(
    findNextDecision(replayStep, viewport.tricks, viewport.playRecommendations, viewport.userSeat) !== null,
  );

  // Derived trick selection for TrickReviewPanel sync
  const selectedTrickIndex = $derived<number | null>(
    replayStep > 0 ? replayPos.trickIndex : null,
  );

  function handleSelectTrick(index: number | null) {
    if (index === null) {
      replayStep = 0;
    } else {
      replayStep = stepAtPosition({ trickIndex: index, playIndex: -1 }, viewport.tricks);
    }
    // Clear bid step when selecting a trick
    selectedBidStep = null;
  }

  function handleClickTrick(index: number) {
    replayStep = stepAtPosition({ trickIndex: index, playIndex: -1 }, viewport.tricks);
  }

  function handleNextDecision() {
    const next = findNextDecision(replayStep, viewport.tricks, viewport.playRecommendations, viewport.userSeat);
    if (next !== null) replayStep = next;
  }

  const trumpSuit = $derived(
    viewport.contract && viewport.contract.strain !== BidSuit.NoTrump
      ? (viewport.contract.strain as unknown as Suit)
      : undefined,
  );

  const selectedTrick = $derived(
    selectedTrickIndex !== null && selectedTrickIndex < viewport.tricks.length
      ? viewport.tricks[selectedTrickIndex]
      : null,
  );

  const selectedTrickRec = $derived(
    selectedTrickIndex !== null
      ? viewport.playRecommendations.find((r) => r.trickIndex === selectedTrickIndex)
      : undefined,
  );

  // Visible plays for TrickOverlay: show partial plays for the current trick during replay
  const overlayVisiblePlays = $derived.by(() => {
    if (!selectedTrick) return undefined;
    if (selectedTrickIndex === replayPos.trickIndex) {
      return replayPos.playIndex + 1;
    }
    return undefined;
  });

  // Reset replay and bid step on new deal
  $effect(() => {
    void dealNumber;
    replayStep = 0;
    selectedBidStep = null;
  });
</script>

{#if hasPlayData}
  <!-- 3-column layout when play data exists -->
  <div class={REVIEW_PHASE_CONTAINER_CLASS}>
    <!-- Desktop: left panel with trick history -->
    <aside class="hidden lg:flex lg:flex-col lg:h-full bg-bg-base p-3 min-h-0 overflow-hidden" style="font-size: var(--panel-font, 1rem);" aria-label="Play history">
      <PlayHistoryPanel
        tricks={viewport.tricks}
        declarerSeat={viewport.contract?.declarer ?? null}
        auctionEntries={viewport.auctionEntries}
        dealer={viewport.dealer}
        bidHistory={viewport.bidHistory}
        highlightTrickIndex={selectedTrickIndex}
        onClickTrick={handleClickTrick}
        visibleTrickCount={replayVis.visibleTrickCount}
        partialTrickPlays={replayVis.partialTrickPlays}
      />
    </aside>

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
              <HandFan cards={viewport.allHands[seat].cards} faceUp {trumpSuit} />
            </section>
          {/each}
        </div>
      </div>
    {:else}
      <div class="flex flex-col min-h-0 flex-1">
        <ScaledTableArea
          scale={layout.tableScale}
          origin={layout.tableOrigin}
          tableWidth={layout.tableBaseW}
          tableHeight={layout.tableBaseH}
        >
          <BridgeTable visibleHands={steppedVisibleHands} vulnerability={viewport.vulnerability} {trumpSuit}>
            {#if selectedTrick && viewport.contract}
              <TrickOverlay
                trick={selectedTrick}
                recommendation={selectedTrickRec}
                contract={viewport.contract}
                visiblePlays={overlayVisiblePlays}
              />
            {:else}
              <div class="flex flex-col items-center gap-2">
                <div
                  class="bg-bg-card border-border-subtle rounded-[--radius-lg] border p-3 shadow-md"
                >
                  <AuctionTable
                    entries={steppedAuctionEntries}
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
            {/if}
          </BridgeTable>
        </ScaledTableArea>

        <!-- Replay controls below table (hidden when showing all cards) -->
        <div class="shrink-0 px-3 pb-2 pt-1">
          <ReplayControls
            step={replayStep}
            {maxSteps}
            trickIndex={replayPos.trickIndex}
            playIndex={replayPos.playIndex}
            totalTricks={viewport.tricks.length}
            {hasNextDecision}
            onStepBack={() => { if (replayStep > 0) replayStep--; }}
            onStepForward={() => { if (replayStep < maxSteps - 1) replayStep++; }}
            onJumpStart={() => { replayStep = 0; }}
            onJumpEnd={() => { replayStep = maxSteps - 1; }}
            onNextDecision={handleNextDecision}
          />
        </div>
      </div>
    {/if}

    <aside class="{SIDE_PANEL_CLASS}" style="font-size: var(--panel-font, 1rem);" aria-label="Review panel">
      <ReviewSidePanel
        contract={viewport.contract}
        score={viewport.score}
        declarerTricksWon={viewport.declarerTricksWon}
        defenderTricksWon={viewport.defenderTricksWon}
        bidHistory={viewport.bidHistory}
        {ddsSolution}
        {ddsSolving}
        {ddsError}
        vulnerability={viewport.vulnerability}
        {dealNumber}
        {onNextDeal}
        {onBackToMenu}
        {onPlayHand}
        onOpenSettings={() => settingsDialogRef?.open()}
        tricks={viewport.tricks}
        playRecommendations={viewport.playRecommendations}
        userSeat={viewport.userSeat}
        {selectedTrickIndex}
        onSelectTrick={handleSelectTrick}
        auctionEntries={viewport.auctionEntries}
        dealer={viewport.dealer}
        {selectedBidStep}
        onSelectBidStep={handleSelectBidStep}
        {totalBids}
      />
    </aside>
  </div>
{:else}
  <!-- 2-column layout for passed-out hands (no play data) -->
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
              <HandFan cards={viewport.allHands[seat].cards} faceUp {trumpSuit} />
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
        <BridgeTable visibleHands={steppedVisibleHands} vulnerability={viewport.vulnerability} {trumpSuit}>
          <div class="flex flex-col items-center gap-2">
            <div
              class="bg-bg-card border-border-subtle rounded-[--radius-lg] border p-3 shadow-md"
            >
              <AuctionTable
                entries={steppedAuctionEntries}
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
        defenderTricksWon={viewport.defenderTricksWon}
        bidHistory={viewport.bidHistory}
        {ddsSolution}
        {ddsSolving}
        {ddsError}
        vulnerability={viewport.vulnerability}
        {dealNumber}
        {onNextDeal}
        {onBackToMenu}
        {onPlayHand}
        onOpenSettings={() => settingsDialogRef?.open()}
        tricks={viewport.tricks}
        playRecommendations={viewport.playRecommendations}
        userSeat={viewport.userSeat}
        selectedTrickIndex={null}
        onSelectTrick={handleSelectTrick}
        {selectedBidStep}
        onSelectBidStep={handleSelectBidStep}
        {totalBids}
      />
    </aside>
  </div>
{/if}

<SettingsDialog readonly bind:this={settingsDialogRef} />
