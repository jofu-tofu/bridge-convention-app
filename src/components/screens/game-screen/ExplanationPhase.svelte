<script lang="ts">
  import { SvelteMap } from "svelte/reactivity";
  import { Seat, Suit, BidSuit, Vulnerability as Vul, partnerSeat, PracticeMode } from "../../../service";
  import type { ExplanationViewport } from "../../../service";
  import type { ConventionInfo, ConventionContribution } from "../../../service";
  import { formatRuleName } from "../../../service";
  import { getLayoutConfig } from "../../../stores/context";
  import { getAppStore, getGameStore } from "../../../stores/context";
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
  import ContractDisplay from "./ContractDisplay.svelte";
  import AuctionStepPanel from "../../game/AuctionStepPanel.svelte";
  import RoundBidList from "../../game/RoundBidList.svelte";
  import AnalysisPanel from "../../game/AnalysisPanel.svelte";
  import TrickReviewPanel from "../../game/TrickReviewPanel.svelte";
  import Button from "../../shared/Button.svelte";
  import Spinner from "../../shared/Spinner.svelte";
  import { formatModuleRole, roleColorClasses } from "../../game/bid-feedback/BidFeedbackPanel";
  import { formatVulnerability, formatResult } from "./review-helpers";
  import {
    totalSteps,
    positionAtStep,
    stepAtPosition,
    visibleTricksAtPosition,
    findNextDecision,
    remainingCardsAtPosition,
  } from "../../game/replay-state";
  import { computeVisibleSeats } from "../../game/AuctionStepPanel";

  interface Props extends DDSAnalysisProps {
    viewport: ExplanationViewport;
    dealNumber: number;
    onNextDeal: () => void;
    onBackToMenu: () => void;
    onPlayHand?: (() => void) | undefined;
    convention?: ConventionInfo | undefined;
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
  const gameStore = getGameStore();

  const practiceMode = $derived(gameStore.practiceMode);

  // Dummy seat: partner of declarer (undefined if passed out)
  const dummySeat = $derived(
    viewport.contract ? partnerSeat(viewport.contract.declarer) : undefined,
  );

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
    computeVisibleSeats(viewport.allHands, viewport.userSeat, viewport.bidHistory, selectedBidStep, dummySeat),
  );

  // Replay state — single source of truth for card-by-card stepping
  let replayStep = $state(0);
  const hasPlayData = $derived(viewport.tricks.length > 0 && viewport.contract !== null);
  const maxSteps = $derived(totalSteps(viewport.tricks));
  const replayPos = $derived(positionAtStep(replayStep, viewport.tricks));
  const replayVis = $derived(visibleTricksAtPosition(replayPos));
  const hasNextDecision = $derived(
    findNextDecision(replayStep, viewport.tricks, viewport.playRecommendations, viewport.userSeat) !== null,
  );

  // Remaining cards per seat at the current replay position (cards played so far are removed)
  const replayRemainingCards = $derived(
    hasPlayData ? remainingCardsAtPosition(replayPos, viewport.tricks, viewport.allHands) : undefined,
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

  // Aggregate convention contributions across user bids that have teaching projections
  const conventionSummary = $derived.by(() => {
    const moduleMap = new SvelteMap<string, { role: ConventionContribution["role"]; count: number }>();
    for (const entry of viewport.bidHistory) {
      if (!entry.isUser || !entry.teachingProjection) continue;
      for (const contrib of entry.teachingProjection.conventionsApplied) {
        if (contrib.meaningsProposed.length === 0) continue;
        const existing = moduleMap.get(contrib.moduleId);
        if (!existing || (contrib.role === "primary" && existing.role !== "primary")) {
          moduleMap.set(contrib.moduleId, {
            role: contrib.role,
            count: (existing?.count ?? 0) + 1,
          });
        } else {
          existing.count++;
        }
      }
    }
    return [...moduleMap.entries()].map(([moduleId, data]) => ({
      moduleId,
      role: data.role,
      count: data.count,
    }));
  });
  const showConventionSummary = $derived(conventionSummary.length > 1);

  // Build tab definitions for ReviewSidePanel
  const reviewTabs = $derived.by(() => {
    const tabs: { id: string; label: string; content: typeof biddingTab }[] = [
      { id: "bidding", label: "Bidding", content: biddingTab },
    ];
    if (hasPlayData) {
      tabs.push({ id: "play", label: "Cardplay", content: playTab });
    }
    tabs.push({ id: "analysis", label: "Analysis", content: analysisTab });
    return tabs;
  });
</script>

{#snippet showAllCardsPanel()}
  <div class="flex min-w-0 flex-1 flex-col gap-3 overflow-auto p-4">
    <div class="flex items-center justify-between">
      <div
        class="relative bg-bg-card border-border-subtle rounded-[--radius-lg] border p-2 shadow-md"
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
    <div class="grid grid-cols-2 gap-3">
      {#each [Seat.North, Seat.East, Seat.South, Seat.West] as seat (seat)}
        <section
          class="bg-bg-card border-border-subtle rounded-[--radius-lg] overflow-hidden border p-3"
          style="--card-overlap-h: calc((100% - 13 * var(--card-width)) / 12);"
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
{/snippet}

{#snippet biddingTab()}
  {#if viewport.contract}
    <div class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle">
      <div class="flex items-center justify-between mb-1">
        <p class="text-[--text-label] font-medium text-text-muted">Contract</p>
        <span
          class="text-[--text-annotation] px-2 py-0.5 rounded-full font-medium {viewport.vulnerability === Vul.None
            ? 'bg-bg-elevated text-text-muted'
            : 'bg-vulnerable/80 text-vulnerable-text ring-1 ring-vulnerable-ring/40'}"
          data-testid="vulnerability-label"
        >{formatVulnerability(viewport.vulnerability)}</span>
      </div>
      <ContractDisplay contract={viewport.contract} />
      {#if viewport.score !== null && viewport.score !== undefined}
        {@const result = formatResult(viewport.contract, viewport.score, viewport.declarerTricksWon)}
        {#if result}
          <p
            class="text-[--text-value] font-mono mt-2 {viewport.score >= 0
              ? 'text-accent-success'
              : 'text-accent-danger'}"
            data-testid="score-result"
          >
            {result}
          </p>
        {/if}
      {/if}
    </div>
  {:else}
    <div class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle">
      <div class="flex items-center justify-between mb-1">
        <p class="text-text-muted text-[--text-detail]">Passed out — no contract.</p>
        <span
          class="text-[--text-annotation] px-2 py-0.5 rounded-full font-medium {viewport.vulnerability === Vul.None
            ? 'bg-bg-elevated text-text-muted'
            : 'bg-vulnerable/80 text-vulnerable-text ring-1 ring-vulnerable-ring/40'}"
          data-testid="vulnerability-label"
        >{formatVulnerability(viewport.vulnerability)}</span>
      </div>
    </div>
  {/if}

  {#if practiceMode !== PracticeMode.DecisionDrill}
    <p class="text-[--text-annotation] text-text-muted">
      Mode: {practiceMode === PracticeMode.FullAuction ? "Full Auction" : "Continuation"}
    </p>
  {/if}

  {#if hasPlayData}
    <AuctionStepPanel
      bidHistory={viewport.bidHistory}
      {selectedBidStep}
      onSelectBidStep={handleSelectBidStep}
      {totalBids}
    />
  {:else}
    <div class="flex flex-col gap-3">
      <h3 class="text-[--text-value] font-semibold text-text-secondary">Bidding Review</h3>
      <RoundBidList bidHistory={viewport.bidHistory} showExpectedResult />
    </div>
  {/if}

  {#if showConventionSummary}
    <div class="mt-3 bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle">
      <p class="text-[--text-label] font-medium text-text-muted mb-2">Conventions in this deal</p>
      <div class="flex flex-wrap gap-1.5">
        {#each conventionSummary as mod (mod.moduleId)}
          <span
            class="inline-flex items-center gap-1 rounded border px-2 py-1 text-[--text-detail] {roleColorClasses(mod.role)}"
          >
            <span class="font-medium">{formatRuleName(mod.moduleId)}</span>
            <span class="opacity-70">{formatModuleRole(mod.role)}</span>
          </span>
        {/each}
      </div>
    </div>
  {/if}
{/snippet}

{#snippet playTab()}
  {#if hasPlayData && viewport.contract && viewport.userSeat}
    <!-- Mobile-only condensed trick history (desktop has dedicated left panel) -->
    <div class="lg:hidden mb-3 max-h-40 overflow-y-auto">
      <PlayHistoryPanel
        tricks={viewport.tricks}
        declarerSeat={viewport.contract.declarer}
        auctionEntries={viewport.auctionEntries}
        dealer={viewport.dealer}
        bidHistory={viewport.bidHistory}
      />
    </div>
    <TrickReviewPanel
      tricks={viewport.tricks}
      recommendations={viewport.playRecommendations}
      contract={viewport.contract}
      userSeat={viewport.userSeat}
      declarerTricksWon={viewport.declarerTricksWon}
      defenderTricksWon={viewport.defenderTricksWon}
      {selectedTrickIndex}
      onSelectTrick={handleSelectTrick}
    />
  {/if}
{/snippet}

{#snippet analysisTab()}
  {#if ddsSolving}
    <div class="flex items-center gap-2 p-4" aria-live="polite">
      <Spinner />
      <span class="text-text-secondary text-[--text-detail]">Analyzing deal...</span>
    </div>
  {:else if ddsError}
    <div
      class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle"
      role="alert"
    >
      <p class="text-text-muted text-[--text-detail]">{ddsError}</p>
    </div>
  {:else if ddsSolution}
    <AnalysisPanel
      {ddsSolution}
      contract={viewport.contract}
      score={viewport.score}
      declarerTricksWon={viewport.declarerTricksWon}
    />
  {:else}
    <div
      class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle"
    >
      <p class="text-text-muted text-[--text-detail]">
        DDS analysis not available.
      </p>
    </div>
  {/if}
{/snippet}

{#snippet reviewActions()}
  {#if onPlayHand}
    <Button onclick={onPlayHand} disabled={gameStore.isTransitioning}>Play this Hand</Button>
  {/if}
  <Button variant={onPlayHand ? "secondary" : "primary"} onclick={onNextDeal} disabled={gameStore.isTransitioning} testId="next-deal">
    {#if gameStore.isTransitioning}
      <Spinner />
    {/if}
    Next Deal
  </Button>
  <Button variant="secondary" onclick={onBackToMenu} testId="review-back-to-menu">Back to Menu</Button>
  <Button variant="secondary" onclick={() => settingsDialogRef?.open()} testId="review-open-settings">Settings</Button>
{/snippet}

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
      {@render showAllCardsPanel()}
    {:else}
      <div class="flex flex-col min-h-0 flex-1">
        <ScaledTableArea
          scale={layout.tableScale}
          origin={layout.tableOrigin}
          tableWidth={layout.tableBaseW}
          tableHeight={layout.tableBaseH}
        >
          <BridgeTable visibleHands={steppedVisibleHands} vulnerability={viewport.vulnerability} {trumpSuit} remainingCards={replayRemainingCards}>
            {#if selectedTrick && viewport.contract}
              <TrickOverlay
                trick={selectedTrick}
                recommendation={selectedTrickRec}
                visiblePlays={overlayVisiblePlays}
              />
            {:else}
              <div class="flex flex-col items-center gap-2">
                <div
                  class="relative bg-bg-card border-border-subtle rounded-[--radius-lg] border p-3 shadow-md"
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
      <ReviewSidePanel tabs={reviewTabs} actions={reviewActions} {dealNumber} />
    </aside>
  </div>
{:else}
  <!-- 2-column layout for passed-out hands (no play data) -->
  <div class={PHASE_CONTAINER_CLASS}>
    {#if showAllCards}
      {@render showAllCardsPanel()}
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
              class="relative bg-bg-card border-border-subtle rounded-[--radius-lg] border p-3 shadow-md"
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
      <ReviewSidePanel tabs={reviewTabs} actions={reviewActions} {dealNumber} />
    </aside>
  </div>
{/if}

<SettingsDialog readonly bind:this={settingsDialogRef} />
