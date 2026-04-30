<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { Seat, PracticeMode, PromptMode, listConventions } from "../../../service";
  import type { Call } from "../../../service";
  import { buildConventionCardPanel, buildAcblCardPanel } from "../../../service";
  import { getGameStore, getAppStore, setLayoutConfig, getCustomSystemsStore } from "../../../stores/context";
  import { resolveSystemForSession } from "../../../stores/custom-systems.svelte";
  import type { SessionConfig } from "../../../service";

  import { computeTableScale } from "../../shared/table-scale";
  import { displayConventionName } from "../../../service";
  import { DESKTOP_MIN } from "../../shared/breakpoints.svelte";

  import BiddingPhase from "./BiddingPhase.svelte";
  import DeclarerPromptPhase from "./DeclarerPromptPhase.svelte";
  import PlayingPhase from "./PlayingPhase.svelte";
  import ExplanationPhase from "./ExplanationPhase.svelte";
  import LearnPhase from "./LearnPhase.svelte";
  import ConventionCardPanel from "../../game/ConventionCardPanel.svelte";
  import DebugDrawer from "../../game/DebugDrawer.svelte";

  const DEV = import.meta.env.DEV;

  const gameStore = getGameStore();
  const appStore = getAppStore();
  const customSystemsStore = getCustomSystemsStore();
  const allConventions = listConventions();

  const userSeat = Seat.South;

  /** Layout constants for responsive scaling */
  const LAYOUT = {
    DEBUG_PANEL_W: 420,
    ROOT_FONT_MULTIPLIER: 0.015,
    FONT_MAX: 28,
    FONT_MIN: 16,
    SIDE_PANEL_REM_MAX: 26,
    SIDE_PANEL_REM_MIN: 14,
    SIDE_PANEL_WIDTH_RATIO: 0.25,
    GAP_REM: 0.75,
    PANEL_FONT_DAMPEN: 0.4,
    PANEL_FONT_MIN: 12,
    PADDING: 32,
    HEADER_H: 64,
  } as const;

  let dealNumber = $state(0);

  // DEV autoplay: auto-bid correct call, auto-accept prompts, auto-play cards
  // Uses requestAnimationFrame to defer actions to next frame, avoiding infinite microtask loops
  $effect(() => {
    if (!DEV || !appStore.autoplay) return;
    const phase = gameStore.phase;
    const isUserTurn = gameStore.isUserTurn;
    const feedback = gameStore.bidFeedback;

    let raf: number | undefined;

    if (phase === "BIDDING" && isUserTurn && !feedback) {
      raf = requestAnimationFrame(() => {
        void gameStore.getExpectedBid().then((result: { call: Call } | null) => {
          const call = result?.call ?? { type: "pass" as const };
          gameStore.userBid(call);
        });
      });
    } else if (phase === "BIDDING" && feedback && gameStore.isFeedbackBlocking) {
      // Blocking feedback only: auto-retry then re-bid the correct answer
      raf = requestAnimationFrame(() => {
        gameStore.retryBid();
        void gameStore.getExpectedBid().then((result: { call: Call } | null) => {
          const call = result?.call ?? { type: "pass" as const };
          gameStore.userBid(call);
        });
      });
    } else if (phase === "DECLARER_PROMPT") {
      raf = requestAnimationFrame(() => gameStore.acceptPrompt());
    } else if (phase === "PLAYING" && !gameStore.isProcessing) {
      const vp = gameStore.playingViewport;
      if (vp && vp.currentPlayer && vp.userControlledSeats.includes(vp.currentPlayer) && vp.legalPlays.length > 0) {
        raf = requestAnimationFrame(() => {
          gameStore.userPlayCard(vp.legalPlays[0]!, vp.currentPlayer!);
        });
      }
    }

    return () => { if (raf) cancelAnimationFrame(raf); };
  });

  function getDevSeed(): number | undefined {
    if (appStore.devSeed === null) return undefined;
    return appStore.devSeed + appStore.devDealCount;
  }

  function startNewDrill() {
    const activeLaunch = appStore.activeLaunch;
    let currentConvention = appStore.selectedConvention;
    if (activeLaunch && activeLaunch.moduleIds.length > 0) {
      const currentIndex = activeLaunch.moduleIds.indexOf(gameStore.currentModuleId);
      const nextIndex = gameStore.isInitialized && currentIndex >= 0
        ? (currentIndex + 1) % activeLaunch.moduleIds.length
        : 0;
      const nextModuleId = activeLaunch.moduleIds[nextIndex] ?? activeLaunch.moduleIds[0];
      currentConvention = allConventions.find((convention) => convention.id === nextModuleId) ?? currentConvention;
    }
    if (!currentConvention) return;
    dealNumber++;

    const devSeed = getDevSeed();
    if (devSeed !== undefined) appStore.advanceDevDeal();

    // Build session config — service handles convention resolution,
    // RNG creation, deal generation, and strategy assembly internally.
    const requestedRole = activeLaunch?.practiceRole ?? appStore.practiceRole;
    const practiceMode = appStore.devPracticeMode ?? activeLaunch?.practiceMode ?? appStore.userPracticeMode;
    const practiceRole = appStore.devPracticeRole
      ?? (requestedRole === "auto" ? currentConvention.defaultRole : requestedRole);
    const drill = appStore.drillSettings;
    const systemSelectionId = activeLaunch?.systemSelectionId ?? appStore.baseSystemId;
    const { systemConfig, baseModuleIds } = resolveSystemForSession(
      systemSelectionId,
      customSystemsStore.systems,
    );
    const config: SessionConfig = {
      conventionId: currentConvention.id,
      userSeat,
      seed: devSeed,
      systemConfig,
      baseModuleIds,
      targetModuleId: currentConvention.id,
      opponentMode: drill.opponentMode,
      vulnerabilityDistribution: drill.tuning.vulnerabilityDistribution,
      ...(drill.playProfileId ? { playProfileId: drill.playProfileId } : {}),
      ...(drill.playPreference ? { playPreference: drill.playPreference } : {}),
      ...(practiceMode ? { practiceMode } : {}),
      ...(practiceRole ? { practiceRole } : {}),
    };

    appStore.selectConvention(currentConvention);
    gameStore.startNewDrill(config);
  }

  // Defer debug drawer mounting — DebugDrawer's $derived computations
  // can interfere with the {#if isInitialized} block's initial render
  // in Svelte 5, silently preventing the game from appearing.
  let debugReady = $state(false);

  // DEV autoDismiss: auto-retry wrong bids after a brief pause
  $effect(() => {
    if (!DEV || !appStore.autoDismissFeedback) return;
    const feedback = gameStore.bidFeedback;
    if (!feedback) return;

    const timer = setTimeout(() => {
      gameStore.retryBid();
    }, 100);
    return () => clearTimeout(timer);
  });

  // Learn mode: auto-skip bidding to review when initialized
  $effect(() => {
    if (gameStore.practiceMode !== PracticeMode.Learn) return;
    if (gameStore.phase !== "BIDDING" || !gameStore.isInitialized) return;
    void gameStore.skipToPhase("review");
  });

  // Defer debug drawer until game is initialized (avoids DebugDrawer $derived
  // computations interfering with the {#if isInitialized} block's initial render)
  $effect(() => {
    if (gameStore.isInitialized && !debugReady) {
      debugReady = true;
    }
  });

  onMount(() => {
    // Skip if a deal is already in progress
    if (gameStore.isInitialized && gameStore.phase === "BIDDING") {
      dealNumber++;
      return;
    }
    startNewDrill();
    // ?phase= skip: handled after drill initializes via effect or manual trigger
    const target = appStore.skipToPhase;
    if (target) {
      // Wait for drill to initialize, then skip to target phase
      void (async () => {
        while (!gameStore.isInitialized) await new Promise(r => setTimeout(r, 50));
        await gameStore.skipToPhase(target);
        appStore.setSkipToPhase(null);
      })();
    }
  });

  onDestroy(() => {
    gameStore.reset();
  });

  function handleNextDeal() {
    startNewDrill();
  }

  interface PhaseInfo {
    label: string;
    color: string;
    textColor: string;
  }

  const PHASE_DISPLAY: Record<string, PhaseInfo> = {
    BIDDING: { label: "Bidding", color: "bg-phase-bidding", textColor: "text-phase-bidding-text" },
    DECLARER_PROMPT: { label: "Declarer", color: "bg-phase-declarer", textColor: "text-phase-declarer-text" },
    PLAYING: { label: "Playing", color: "bg-phase-playing", textColor: "text-phase-playing-text" },
    EXPLANATION: { label: "Review", color: "bg-phase-review", textColor: "text-phase-review-text" },
  };

  const DEFENDER_PHASE: PhaseInfo = { label: "Defend", color: "bg-phase-playing", textColor: "text-phase-playing-text" };

  // Phase display info
  const phaseInfo = $derived.by(() => {
    if (gameStore.phase === "DECLARER_PROMPT" && gameStore.promptMode === PromptMode.Defender) {
      return DEFENDER_PHASE;
    }
    return PHASE_DISPLAY[gameStore.phase] ?? { label: "Unknown", color: "bg-phase-unknown", textColor: "text-phase-unknown-text" };
  });

  // Responsive layout — single source of truth for all sizing.
  // availableW accounts for debug panel; all downstream values (rootFontSize,
  // sidePanelW, tableScale) derive from it. CSS variables (--width-side-panel,
  // --game-scale, --panel-font) are set inline on <main>, NOT in app.css,
  // so they always reflect the actual available space.
  let windowW = $state(1024);
  let containerW = $state(1024);
  let innerH = $state(768);
  let headerH = $state(0);

  const debugPanelW = $derived(DEV && appStore.debugPanelOpen ? LAYOUT.DEBUG_PANEL_W : 0);
  const availableW = $derived(containerW - debugPanelW);

  const rootFontSize = $derived(Math.min(LAYOUT.FONT_MAX, Math.max(LAYOUT.FONT_MIN, availableW * LAYOUT.ROOT_FONT_MULTIPLIER)));
  const tableBaseW = 800;
  const tableBaseH = 650;
  const sidePanelW = $derived(
    Math.min(LAYOUT.SIDE_PANEL_REM_MAX * rootFontSize, Math.max(LAYOUT.SIDE_PANEL_REM_MIN * rootFontSize, availableW * LAYOUT.SIDE_PANEL_WIDTH_RATIO)),
  );

  const isDesktop = $derived(windowW >= DESKTOP_MIN);
  const playHistoryW = $derived(Math.round(sidePanelW * 0.8));
  // PLAYING phase has a second panel on the left — account for both in scale
  const hasTwoPanels = $derived(
    isDesktop && (
      gameStore.phase === "PLAYING" ||
      (gameStore.phase === "EXPLANATION" && (gameStore.explanationViewport?.tricks.length ?? 0) > 0)
    ),
  );
  const effectiveSidePanelW = $derived(hasTwoPanels ? sidePanelW + playHistoryW : sidePanelW);
  // gap-3 = 0.75rem per gap; 2 gaps in 3-col layout, 1 gap in 2-col layout
  const gridGaps = $derived(isDesktop ? (hasTwoPanels ? 2 : 1) * LAYOUT.GAP_REM * rootFontSize : 0);
  // On mobile/tablet, the table and side panel stack vertically, each taking
  // ~50% of the non-header space. Account for this by treating the side panel
  // half as unavailable height so the table scales down to fit.
  const effectiveHeaderH = $derived(
    isDesktop
      ? headerH || LAYOUT.HEADER_H
      : (innerH + (headerH || LAYOUT.HEADER_H)) / 2,
  );
  const tableScale = $derived(
    computeTableScale(availableW, innerH, {
      sidePanel: isDesktop,
      tableW: tableBaseW,
      tableH: tableBaseH,
      sidePanelW: effectiveSidePanelW,
      headerH: effectiveHeaderH,
      padding: LAYOUT.PADDING + gridGaps,
    }),
  );

  // Panel font: scales with the table so text in panels and on the table
  // feel proportional. Uses a dampened curve (0.4 + 0.4*scale) so panels
  // don't shrink as aggressively as the table itself.
  const panelFontPx = $derived(
    Math.max(LAYOUT.PANEL_FONT_MIN, Math.round(rootFontSize * (LAYOUT.PANEL_FONT_DAMPEN + LAYOUT.PANEL_FONT_DAMPEN * tableScale))),
  );

  const tableOrigin = "top left";

  // Expose layout configuration via context so phase components can read it
  // without prop drilling. Uses getters so derived values stay reactive.
  // Responsive class strings (phase containers, side panels) are now static
  // Tailwind-responsive constants in layout-props.ts — no JS derivation needed.
  setLayoutConfig({
    get tableScale() { return tableScale; },
    get tableOrigin() { return tableOrigin; },
    tableBaseW,
    tableBaseH,
  });

  // Convention card panel — structured sections from system config + active modules
  const resolvedSystem = $derived(resolveSystemForSession(
    appStore.baseSystemId,
    customSystemsStore.systems,
  ));
  const ccPanelView = $derived(buildConventionCardPanel(resolvedSystem.systemConfig, appStore.selectedConvention?.id));
  const acblPanelView = $derived(buildAcblCardPanel(resolvedSystem.systemConfig, appStore.selectedConvention?.id));
  let ccPanelOpen = $state(false);

  function handleBackToMenu() {
    gameStore.reset();
    appStore.clearSelection();
    void goto("/practice");
  }
</script>

<svelte:window bind:innerWidth={windowW} bind:innerHeight={innerH} />

<div bind:clientWidth={containerW} class="h-full w-full">
{#if gameStore.isInitialized}
  <main class="h-full w-full flex flex-row overflow-hidden" aria-label="Bridge drill" style="--game-scale: {tableScale}; --panel-font: {panelFontPx}px; --width-side-panel: {sidePanelW}px; --width-play-history: {playHistoryW}px;">
    <div class="flex-1 min-w-0 flex flex-col overflow-hidden" style="max-width: {availableW}px;">
    <a href="#game-content" class="sr-only focus:not-sr-only focus:absolute focus:z-[var(--z-above-all)] focus:p-2 focus:bg-bg-card focus:text-text-primary focus:rounded-[--radius-md]">
      Skip to game
    </a>
    <!-- Header -->
    <header
      bind:clientHeight={headerH}
      class="flex items-center justify-between px-3 sm:px-6 py-3 border-b border-border-subtle shrink-0 bg-bg-base"
    >
      <div class="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        <h1 class="text-[--text-heading] font-semibold text-text-primary truncate min-w-0">
          {displayConventionName(appStore.selectedConvention?.name ?? "Drill")} Practice
        </h1>
        <span
          class="shrink-0 px-2.5 py-0.5 rounded-full text-[--text-label] font-semibold {phaseInfo.color} {phaseInfo.textColor}"
          data-testid="game-phase"
        >
          {phaseInfo.label}
        </span>
        {#if gameStore.practiceMode === PracticeMode.FullAuction}
          <span class="text-[--text-annotation] text-text-muted" data-testid="practice-mode-label">
            Full Auction
          </span>
        {:else if gameStore.practiceMode === PracticeMode.Learn}
          <span class="text-[--text-annotation] text-text-muted" data-testid="practice-mode-label">
            Learn
          </span>
        {/if}
        <span class="sr-only" aria-live="polite">Phase: {phaseInfo.label}</span>
        <button
          class="px-1.5 py-0.5 text-[--text-annotation] font-bold tracking-wide
                 bg-bg-card border border-border-subtle rounded-[--radius-sm]
                 text-text-secondary hover:text-text-primary hover:border-accent-primary
                 cursor-pointer transition-colors"
          class:border-accent-primary={ccPanelOpen}
          class:text-text-primary={ccPanelOpen}
          onclick={() => { ccPanelOpen = !ccPanelOpen; }}
          aria-label="Convention card"
          aria-expanded={ccPanelOpen}
          data-testid="convention-card-trigger"
        >
          CC
        </button>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <span class="text-text-secondary text-[--text-body]">
          Deal #{dealNumber}
          {#if gameStore.practiceMode !== PracticeMode.Learn && gameStore.sessionStats.correct + gameStore.sessionStats.incorrect > 0}
            <span class="text-text-muted mx-1">&middot;</span>
            <span class="text-fb-correct-text">{gameStore.sessionStats.correct}</span><!--
            -->/<span class="text-text-muted">{gameStore.sessionStats.correct + gameStore.sessionStats.incorrect}</span>
            {#if gameStore.sessionStats.streak >= 2}
              <span class="text-text-muted mx-1">&middot;</span>
              <span class="text-fb-correct-text">{gameStore.sessionStats.streak} streak</span>
            {/if}
          {/if}
        </span>
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
        onNewDeal={handleNextDeal}
      />
    {:else if gameStore.phase === "DECLARER_PROMPT" && gameStore.declarerPromptViewport}
      <DeclarerPromptPhase
        viewport={gameStore.declarerPromptViewport}
        onAccept={() => gameStore.acceptPrompt()}
        onSkip={() => gameStore.declinePrompt()}
      />
    {:else if gameStore.phase === "PLAYING" && gameStore.playingViewport}
      <PlayingPhase
        viewport={gameStore.playingViewport}
        animatedCurrentTrick={gameStore.currentTrick}
        onPlayCard={(card, seat) => gameStore.userPlayCard(card, seat)}
        onSkipToReview={() => gameStore.skipToReview()}
        onRestartPlay={() => gameStore.restartPlay()}
      />
    {:else if gameStore.phase === "EXPLANATION" && gameStore.practiceMode === PracticeMode.Learn && gameStore.explanationViewport}
      <LearnPhase
        viewport={gameStore.explanationViewport}
        {dealNumber}
        onNextDeal={handleNextDeal}
        onBackToMenu={handleBackToMenu}
      />
    {:else if gameStore.phase === "EXPLANATION" && gameStore.explanationViewport}
      <ExplanationPhase
        viewport={gameStore.explanationViewport}
        ddsSolution={gameStore.ddsSolution}
        ddsSolving={gameStore.ddsSolving}
        ddsError={gameStore.ddsError}
        {dealNumber}
        onNextDeal={handleNextDeal}
        onBackToMenu={handleBackToMenu}
        onPlayHand={gameStore.contract ? () => gameStore.playThisHand() : undefined}
        convention={appStore.selectedConvention ?? undefined}
      />
    {/if}
    </div>
    </div>

    {#if DEV && debugReady}
      <DebugDrawer
        open={appStore.debugPanelOpen}
        onNewDeal={handleNextDeal}
        onBackToMenu={handleBackToMenu}
      />
    {/if}

    <ConventionCardPanel panelView={ccPanelView} acblPanelView={acblPanelView} open={ccPanelOpen} onclose={() => { ccPanelOpen = false; }} />
  </main>
{:else}
  <div class="flex items-center justify-center h-full">
    <div class="flex flex-col items-center gap-4">
      <div class="loading-spinner" aria-hidden="true"></div>
      <p class="text-text-secondary text-[--text-detail] font-medium tracking-wide">Dealing cards&hellip;</p>
    </div>
  </div>
{/if}
</div>

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
