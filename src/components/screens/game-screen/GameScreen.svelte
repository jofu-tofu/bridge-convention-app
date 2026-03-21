<script lang="ts">
  import { onMount } from "svelte";
  import { Seat } from "../../../engine/types";
  import type { Call } from "../../../engine/types";
  import { getGameStore, getAppStore, setLayoutConfig, getService } from "../../../stores/context";
  import type { SessionConfig } from "../../../service";

  import { computeTableScale } from "../../../core/display/table-scale";
  import { DESKTOP_MIN } from "../../../core/display/breakpoints.svelte";

  import BiddingPhase from "./BiddingPhase.svelte";
  import DeclarerPromptPhase from "./DeclarerPromptPhase.svelte";
  import PlayingPhase from "./PlayingPhase.svelte";
  import ExplanationPhase from "./ExplanationPhase.svelte";
  import DebugDrawer from "../../game/DebugDrawer.svelte";

  const DEV = import.meta.env.DEV;

  const service = getService();
  const gameStore = getGameStore();
  const appStore = getAppStore();

  const userSeat = Seat.South;

  let dealNumber = $state(0);

  // Refresh legal plays when current player changes during PLAYING phase
  $effect(() => {
    const player = gameStore.currentPlayer;
    if (gameStore.phase === "PLAYING" && player) {
      gameStore.refreshLegalPlays();
    }
  });

  // DEV autoplay: auto-bid correct call, auto-dismiss feedback, auto-skip prompts
  // Uses requestAnimationFrame to defer actions to next frame, avoiding infinite microtask loops
  $effect(() => {
    if (!DEV || !appStore.autoplay) return;
    const phase = gameStore.phase;
    const isUserTurn = gameStore.isUserTurn;
    const feedback = gameStore.bidFeedback;

    let raf: number | undefined;

    if (phase === "BIDDING" && isUserTurn && !feedback) {
      const result = gameStore.getExpectedBid();
      const call = result?.call ?? { type: "pass" as const };
      raf = requestAnimationFrame(() => gameStore.userBid(call));
    } else if (phase === "BIDDING" && feedback) {
      // Correct-path-only: auto-retry then re-bid the correct answer
      raf = requestAnimationFrame(() => {
        gameStore.retryBid();
        const result = gameStore.getExpectedBid();
        const call = result?.call ?? { type: "pass" as const };
        gameStore.userBid(call);
      });
    } else if (phase === "DECLARER_PROMPT") {
      raf = requestAnimationFrame(() => gameStore.declinePrompt());
    }

    return () => { if (raf) cancelAnimationFrame(raf); };
  });

  function getDevSeed(): number | undefined {
    if (appStore.devSeed === null) return undefined;
    return appStore.devSeed + appStore.devDealCount;
  }

  async function startNewDrill() {
    const baseConvention = appStore.selectedConvention;
    if (!baseConvention) return;
    dealNumber++;

    const devSeed = getDevSeed();
    if (devSeed !== undefined) appStore.advanceDevDeal();

    // Build session config — service handles convention resolution,
    // RNG creation, deal generation, and strategy assembly internally.
    const config: SessionConfig = {
      conventionId: baseConvention.id,
      userSeat,
      seed: devSeed,
      baseSystemId: appStore.baseSystemId,
      drill: appStore.drillSettings,
    };

    const handle = await service.createSession(config);
    const bundle = await service.getSessionBundle(handle);
    const conventionName = await service.getConventionName(handle);

    await gameStore.startDrill(bundle);
    gameStore.setConventionName(conventionName);
  }

  onMount(() => {
    // Skip if a deal is already in progress
    if (gameStore.deal && gameStore.phase === "BIDDING") {
      dealNumber++;
      return;
    }
    // eslint-disable-next-line no-console -- startup error should surface in dev tools
    startNewDrill().catch(console.error);
  });

  async function handleNextDeal() {
    await startNewDrill();
  }

  function handleBid(call: Call) {
    gameStore.userBid(call);
  }

  // Phase display info
  const phaseInfo = $derived.by(() => {
    if (gameStore.phase === "BIDDING") {
      return { label: "Bidding", color: "bg-phase-bidding", textColor: "text-phase-bidding-text" };
    }
    if (gameStore.phase === "DECLARER_PROMPT") {
      if (gameStore.promptMode === "defender") {
        return { label: "Defend", color: "bg-phase-playing", textColor: "text-phase-playing-text" };
      }
      return { label: "Declarer", color: "bg-phase-declarer", textColor: "text-phase-declarer-text" };
    }
    if (gameStore.phase === "PLAYING") {
      return { label: "Playing", color: "bg-phase-playing", textColor: "text-phase-playing-text" };
    }
    return { label: "Review", color: "bg-phase-review", textColor: "text-phase-review-text" };
  });

  // Responsive layout — single source of truth for all sizing.
  // availableW accounts for debug panel; all downstream values (rootFontSize,
  // sidePanelW, tableScale) derive from it. CSS variables (--width-side-panel,
  // --game-scale, --panel-font) are set inline on <main>, NOT in app.css,
  // so they always reflect the actual available space.
  let innerW = $state(1024);
  let innerH = $state(768);
  let headerH = $state(0);

  const debugPanelW = $derived(DEV && appStore.debugPanelOpen ? 420 : 0);
  const availableW = $derived(innerW - debugPanelW);

  const rootFontSize = $derived(Math.min(28, Math.max(16, availableW * 0.015)));
  const tableBaseW = 800;
  const tableBaseH = 650;
  const sidePanelW = $derived(
    Math.min(20 * rootFontSize, Math.max(13 * rootFontSize, availableW * 0.18)),
  );

  const isDesktop = $derived(innerW >= DESKTOP_MIN);
  // PLAYING phase has a second panel on the left — account for both in scale
  const hasTwoPanels = $derived(isDesktop && gameStore.phase === "PLAYING");
  const effectiveSidePanelW = $derived(hasTwoPanels ? sidePanelW * 2 : sidePanelW);
  // gap-3 = 0.75rem per gap; 2 gaps in 3-col layout, 1 gap in 2-col layout
  const gridGaps = $derived(isDesktop ? (hasTwoPanels ? 2 : 1) * 0.75 * rootFontSize : 0);
  const tableScale = $derived(
    computeTableScale(availableW, innerH, {
      sidePanel: isDesktop,
      tableW: tableBaseW,
      tableH: tableBaseH,
      sidePanelW: effectiveSidePanelW,
      headerH: headerH || 64,
      padding: 32 + gridGaps,
    }),
  );

  // Panel font: scales with the table so text in panels and on the table
  // feel proportional. Uses a dampened curve (0.5 + 0.5*scale) so panels
  // don't shrink as aggressively as the table itself.
  const panelFontPx = $derived(
    Math.max(12, Math.round(rootFontSize * (0.5 + 0.5 * tableScale))),
  );

  const tableOrigin = $derived(isDesktop ? "top left" : "center");
  const phaseContainerClass = $derived(
    isDesktop
      ? "flex-1 grid grid-cols-[1fr_var(--width-side-panel)] grid-rows-[minmax(0,1fr)] gap-3 overflow-hidden"
      : "flex-1 flex flex-col overflow-hidden",
  );
  const sidePanelClass = $derived(
    `${isDesktop ? "h-full" : "border-t border-border-subtle"} bg-bg-base p-3 flex flex-col min-h-0 overflow-hidden`,
  );

  // Expose layout configuration via context so phase components can read it
  // without prop drilling. Uses getters so derived values stay reactive.
  setLayoutConfig({
    get tableScale() { return tableScale; },
    get tableOrigin() { return tableOrigin; },
    tableBaseW,
    tableBaseH,
    get phaseContainerClass() { return phaseContainerClass; },
    get sidePanelClass() { return sidePanelClass; },
  });

  function handleBackToMenu() {
    gameStore.reset();
    appStore.navigateToMenu();
  }
</script>

<svelte:window bind:innerWidth={innerW} bind:innerHeight={innerH} />

{#if gameStore.deal}
  <main class="h-full w-full flex flex-row overflow-hidden" aria-label="Bridge drill" style="--game-scale: {tableScale}; --panel-font: {panelFontPx}px; --width-side-panel: {sidePanelW}px;">
    <div class="flex-1 min-w-0 flex flex-col overflow-hidden" style="max-width: {availableW}px;">
    <a href="#game-content" class="sr-only focus:not-sr-only focus:absolute focus:z-[--z-above-all] focus:p-2 focus:bg-bg-card focus:text-text-primary focus:rounded-[--radius-md]">
      Skip to game
    </a>
    <!-- Header -->
    <header
      bind:clientHeight={headerH}
      class="flex items-center justify-between px-3 sm:px-6 py-3 border-b border-border-subtle shrink-0 bg-bg-base relative z-[--z-header]"
    >
      <div class="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        <button
          class="shrink-0 min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
          onclick={handleBackToMenu}
          aria-label="Back to menu"
          data-testid="back-to-menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            ><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg
          >
        </button>
        <h1 class="text-[--text-heading] font-semibold text-text-primary truncate min-w-0">
          {appStore.selectedConvention?.name ?? "Drill"} Practice
        </h1>
        <span
          class="shrink-0 px-2.5 py-0.5 rounded-full text-[--text-label] font-semibold {phaseInfo.color} {phaseInfo.textColor}"
          data-testid="game-phase"
        >
          {phaseInfo.label}
        </span>
        <span class="sr-only" aria-live="polite">Phase: {phaseInfo.label}</span>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <span class="text-text-secondary text-[--text-body]">Deal #{dealNumber}</span>
        {#if DEV}
          <button
            class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
            onclick={() => appStore.toggleDebugPanel()}
            aria-label="Toggle debug panel"
            aria-expanded={appStore.debugPanelOpen}
            data-testid="debug-toggle"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          </button>
        {/if}
      </div>
    </header>

    <div id="game-content" class="flex-1 min-h-0 flex flex-col">
    {#if gameStore.phase === "BIDDING" && gameStore.biddingViewport}
      <BiddingPhase
        viewport={gameStore.biddingViewport}
        auction={gameStore.auction}
        bidHistory={gameStore.bidHistory}
        legalCalls={gameStore.legalCalls}
        onBid={handleBid}
        disabled={!gameStore.isUserTurn || gameStore.isFeedbackBlocking || !!gameStore.bidFeedback}
        isUserTurn={gameStore.isUserTurn}
        isFeedbackBlocking={gameStore.isFeedbackBlocking}
        onRetry={() => gameStore.retryBid()}
        viewportFeedback={gameStore.viewportFeedback}
        teachingDetail={gameStore.teachingDetail}
        onNewDeal={handleNextDeal}
      />
    {:else if gameStore.phase === "DECLARER_PROMPT" && gameStore.contract}
      <DeclarerPromptPhase
        deal={gameStore.deal}
        {userSeat}
        faceUpSeats={gameStore.faceUpSeats}
        auction={gameStore.auction}
        contract={gameStore.contract}
        promptMode={gameStore.promptMode ?? "defender"}
        onAccept={() => gameStore.acceptPrompt()}
        onSkip={() => gameStore.declinePrompt()}
      />
    {:else if gameStore.phase === "PLAYING" && gameStore.deal}
      <PlayingPhase
        rotated={gameStore.rotated}
        faceUpSeats={gameStore.faceUpSeats}
        deal={gameStore.deal}
        contract={gameStore.contract}
        currentPlayer={gameStore.currentPlayer}
        currentTrick={gameStore.currentTrick}
        trumpSuit={gameStore.trumpSuit}
        declarerTricksWon={gameStore.declarerTricksWon}
        defenderTricksWon={gameStore.defenderTricksWon}
        legalPlays={gameStore.legalPlaysForCurrentPlayer}
        userControlledSeats={gameStore.userControlledSeats}
        remainingCards={gameStore.remainingCardsPerSeat}
        tricks={gameStore.tricks}
        auction={gameStore.auction}
        bidHistory={gameStore.bidHistory}
        onPlayCard={(card, seat) => gameStore.userPlayCard(card, seat)}
        onSkipToReview={() => gameStore.skipToReview()}
      />
    {:else if gameStore.phase === "EXPLANATION"}
      <ExplanationPhase
        deal={gameStore.deal}
        {userSeat}
        faceUpSeats={gameStore.faceUpSeats}
        auction={gameStore.auction}
        contract={gameStore.contract}
        score={gameStore.score}
        declarerTricksWon={gameStore.declarerTricksWon}
        bidHistory={gameStore.bidHistory}
        ddsSolution={gameStore.ddsSolution}
        ddsSolving={gameStore.ddsSolving}
        ddsError={gameStore.ddsError}
        vulnerability={gameStore.deal.vulnerability}
        {dealNumber}
        onNextDeal={handleNextDeal}
        onBackToMenu={handleBackToMenu}
        onPlayHand={gameStore.contract ? () => gameStore.playThisHand() : undefined}
        convention={appStore.selectedConvention ?? undefined}
      />
    {/if}
    </div>
    </div>

    {#if DEV}
      <DebugDrawer open={appStore.debugPanelOpen} />
    {/if}
  </main>
{:else}
  <div class="flex items-center justify-center h-full">
    <div class="flex flex-col items-center gap-4">
      <div class="loading-spinner" aria-hidden="true"></div>
      <p class="text-text-secondary text-[--text-detail] font-medium tracking-wide">Dealing cards&hellip;</p>
    </div>
  </div>
{/if}

<style>
  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 2.5px solid var(--color-border-subtle);
    border-top-color: var(--color-accent-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
