<script lang="ts">
  import { onMount } from "svelte";
  import { Seat } from "../../../engine/types";
  import type { Call, Card as CardType } from "../../../engine/types";
  import { getEngine, getGameStore, getAppStore } from "../../../stores/context";
  import { BidGrade } from "../../../stores/bidding.svelte";
  import { startDrill } from "../../../bootstrap/start-drill";
  import type { OpponentMode } from "../../../bootstrap/types";
  import { computeTableScale } from "../../../core/display/table-scale";
  import { mulberry32 } from "../../../core/util/seeded-rng";
  import { toBeliefData } from "../../../inference/belief-converter";
  import { conditionOnOwnHand } from "../../../inference/private-belief";
  import BiddingPhase from "./BiddingPhase.svelte";
  import DeclarerPromptPhase from "./DeclarerPromptPhase.svelte";
  import PlayingPhase from "./PlayingPhase.svelte";
  import ExplanationPhase from "./ExplanationPhase.svelte";
  import DebugDrawer from "../../game/DebugDrawer.svelte";

  const DEV = import.meta.env.DEV;

  const engine = getEngine();
  const gameStore = getGameStore();
  const appStore = getAppStore();

  const userSeat = Seat.South;

  let dealNumber = $state(0);

  // Settings dropdown
  let settingsOpen = $state(false);

  $effect(() => {
    if (!settingsOpen) return;
    function close(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-testid="settings-toggle"]') && !target.closest('[role="menu"]')) {
        settingsOpen = false;
      }
    }
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  });

  // Table rotation: only when effectiveUserSeat is exactly North (declarer swap accepted)
  const rotated = $derived(gameStore.effectiveUserSeat === Seat.North);
  // Effective seat for play phase (effectiveUserSeat after swap, or default userSeat)
  const playUserSeat = $derived(gameStore.effectiveUserSeat ?? userSeat);

  // Legal plays for current player — fetched async, owned here as parent
  let playLegalPlays = $state<CardType[]>([]);

  $effect(() => {
    const player = gameStore.currentPlayer;
    if (gameStore.phase === "PLAYING" && player) {
      gameStore.getLegalPlaysForSeat(player).then((plays) => {
        if (gameStore.currentPlayer === player) {
          playLegalPlays = plays;
        }
      });
    } else {
      playLegalPlays = [];
    }
  });

  // Remaining cards per seat during play
  const playRemainingCards = $derived.by(() => {
    if (!gameStore.deal) return undefined;
    const result: Partial<Record<Seat, readonly CardType[]>> = {};
    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      result[seat] = gameStore.getRemainingCards(seat);
    }
    return result;
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
      raf = requestAnimationFrame(() => gameStore.dismissBidFeedback());
    } else if (phase === "DECLARER_PROMPT") {
      raf = requestAnimationFrame(() => {
        if (gameStore.isDefenderPrompt) gameStore.declineDefend();
        else if (gameStore.isSouthDeclarerPrompt) gameStore.declineSouthPlay();
        else gameStore.declineDeclarerSwap();
      });
    }

    return () => { if (raf) cancelAnimationFrame(raf); };
  });

  function getDevSeed(): number | undefined {
    if (appStore.devSeed === null) return undefined;
    return appStore.devSeed + appStore.devDealCount;
  }

  async function startNewDrill() {
    const convention = appStore.selectedConvention;
    if (!convention) return;
    dealNumber++;
    const devSeed = getDevSeed();
    const devRng = devSeed !== undefined ? mulberry32(devSeed) : undefined;
    if (devSeed !== undefined) appStore.advanceDevDeal();
    const bundle = await startDrill(engine, convention, userSeat, devRng, devSeed, {
      opponentMode: appStore.opponentMode,
      beliefProvider: (ctx) => {
        try {
          const priv = conditionOnOwnHand(gameStore.publicBeliefState, ctx.seat, ctx.hand, ctx.evaluation);
          return toBeliefData(gameStore.publicBeliefState, priv);
        } catch {
          return undefined;
        }
      },
    });
    await gameStore.startDrill(bundle);
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
      return { label: "Bidding", color: "bg-blue-600", textColor: "text-blue-100" };
    }
    if (gameStore.phase === "DECLARER_PROMPT") {
      if (gameStore.isDefenderPrompt) {
        return { label: "Defend", color: "bg-amber-600", textColor: "text-amber-100" };
      }
      return { label: "Declarer", color: "bg-teal-600", textColor: "text-teal-100" };
    }
    if (gameStore.phase === "PLAYING") {
      return { label: "Playing", color: "bg-amber-600", textColor: "text-amber-100" };
    }
    return { label: "Review", color: "bg-purple-600", textColor: "text-purple-100" };
  });

  // Whether feedback is showing and blocking input
  const isFeedbackBlocking = $derived(
    gameStore.bidFeedback !== null && gameStore.bidFeedback.grade === BidGrade.Incorrect,
  );

  // Responsive table scaling — measure actual available space
  let innerW = $state(1024);
  let innerH = $state(768);
  let headerH = $state(0);

  const rootFontSize = $derived(Math.min(28, Math.max(16, innerW * 0.015)));
  const tableBaseW = 800;
  const tableBaseH = 650;
  const sidePanelW = $derived(
    Math.min(25 * rootFontSize, Math.max(16 * rootFontSize, innerW * 0.25)),
  );

  const isDesktop = $derived(innerW > 1023);
  const tableScale = $derived(
    computeTableScale(innerW, innerH, {
      sidePanel: isDesktop,
      tableW: tableBaseW,
      tableH: tableBaseH,
      sidePanelW,
      headerH: headerH || 64,
      padding: 16,
    }),
  );

  const tableOrigin = $derived(isDesktop ? "top left" : "center");
  const phaseContainerClass = $derived(
    isDesktop
      ? "flex-1 grid grid-cols-[1fr_var(--width-side-panel)] grid-rows-[1fr] overflow-hidden"
      : "flex-1 flex flex-col overflow-hidden",
  );
  const sidePanelClass = $derived(
    `${isDesktop ? "h-full" : "border-t border-border-subtle"} bg-bg-base p-4 flex flex-col min-h-0 overflow-hidden`,
  );

  function handleBackToMenu() {
    gameStore.reset();
    appStore.navigateToMenu();
  }
</script>

<svelte:window bind:innerWidth={innerW} bind:innerHeight={innerH} />

{#if gameStore.deal}
  <main class="h-full flex flex-col" aria-label="Bridge drill">
    <a href="#game-content" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-bg-card focus:text-text-primary focus:rounded-[--radius-md]">
      Skip to game
    </a>
    <!-- Header -->
    <header
      bind:clientHeight={headerH}
      class="flex items-center justify-between px-6 py-3 border-b border-border-subtle shrink-0 bg-bg-base relative z-10"
    >
      <div class="flex items-center gap-4">
        <button
          class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
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
        <h1 class="text-xl font-semibold text-text-primary">
          {appStore.selectedConvention?.name ?? "Drill"} Practice
        </h1>
        <span
          class="px-2.5 py-0.5 rounded-full text-xs font-semibold {phaseInfo.color} {phaseInfo.textColor}"
          data-testid="game-phase"
        >
          {phaseInfo.label}
        </span>
        <span class="sr-only" aria-live="polite">Phase: {phaseInfo.label}</span>
      </div>
      <div class="flex items-center gap-3">
        <!-- Opponent strategy dropdown -->
        <div class="relative">
          <button
            class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
            onclick={() => settingsOpen = !settingsOpen}
            aria-label="Settings"
            aria-expanded={settingsOpen}
            data-testid="settings-toggle"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          {#if settingsOpen}
            <div
              class="absolute right-0 top-full mt-1 w-56 bg-bg-card border border-border-subtle rounded-[--radius-md] shadow-lg z-50 p-3"
              role="menu"
            >
              <label class="block text-xs font-semibold text-text-secondary mb-1.5">Opponents</label>
              <select
                class="w-full bg-bg-base border border-border-subtle rounded-[--radius-sm] px-2.5 py-1.5 text-sm text-text-primary cursor-pointer"
                value={appStore.opponentMode}
                onchange={(e) => {
                  const target = e.currentTarget;
                  appStore.setOpponentMode(target.value as OpponentMode);
                  settingsOpen = false;
                }}
                data-testid="opponent-mode-select"
              >
                <option value="natural">Natural (bid with good hands)</option>
                <option value="silent">Silent (always pass)</option>
              </select>
              <p class="text-xs text-text-secondary mt-1.5">
                {appStore.opponentMode === "natural"
                  ? "Opponents bid naturally with 6+ HCP and a 5+ card suit."
                  : "Opponents always pass (classic drill mode)."}
              </p>
            </div>
          {/if}
        </div>
        <span class="text-text-secondary text-base">Deal #{dealNumber}</span>
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
    {#if gameStore.phase === "BIDDING"}
      <BiddingPhase
        {tableScale}
        {tableOrigin}
        {tableBaseW}
        {tableBaseH}
        {phaseContainerClass}
        {sidePanelClass}
        deal={gameStore.deal}
        {userSeat}
        auction={gameStore.auction}
        legalCalls={gameStore.legalCalls}
        onBid={handleBid}
        disabled={!gameStore.isUserTurn || isFeedbackBlocking || !!gameStore.bidFeedback}
        isUserTurn={gameStore.isUserTurn}
        {isFeedbackBlocking}
        onDismissFeedback={() => gameStore.dismissBidFeedback()}
        onSkipToReview={() => gameStore.skipFromFeedback()}
        onRetry={() => gameStore.retryBid()}
      />
    {:else if gameStore.phase === "DECLARER_PROMPT" && gameStore.contract}
      <DeclarerPromptPhase
        {tableScale}
        {tableOrigin}
        {tableBaseW}
        {tableBaseH}
        {phaseContainerClass}
        {sidePanelClass}
        deal={gameStore.deal}
        {userSeat}
        auction={gameStore.auction}
        contract={gameStore.contract}
        isDefenderPrompt={gameStore.isDefenderPrompt}
        isSouthDeclarerPrompt={gameStore.isSouthDeclarerPrompt}
        onAccept={gameStore.isDefenderPrompt
          ? () => gameStore.acceptDefend()
          : gameStore.isSouthDeclarerPrompt
            ? () => gameStore.acceptSouthPlay()
            : () => gameStore.acceptDeclarerSwap()}
        onSkip={gameStore.isDefenderPrompt
          ? () => gameStore.declineDefend()
          : gameStore.isSouthDeclarerPrompt
            ? () => gameStore.declineSouthPlay()
            : () => gameStore.declineDeclarerSwap()}
      />
    {:else if gameStore.phase === "PLAYING" && gameStore.deal}
      <PlayingPhase
        {tableScale}
        {tableOrigin}
        {tableBaseW}
        {tableBaseH}
        {phaseContainerClass}
        {sidePanelClass}
        {playUserSeat}
        {rotated}
        deal={gameStore.deal}
        contract={gameStore.contract}
        currentPlayer={gameStore.currentPlayer}
        dummySeat={gameStore.dummySeat ?? undefined}
        currentTrick={gameStore.currentTrick}
        trumpSuit={gameStore.trumpSuit}
        declarerTricksWon={gameStore.declarerTricksWon}
        defenderTricksWon={gameStore.defenderTricksWon}
        legalPlays={playLegalPlays}
        remainingCards={playRemainingCards}
        onPlayCard={(card, seat) => gameStore.userPlayCard(card, seat)}
        onSkipToReview={() => gameStore.skipToReview()}
      />
    {:else if gameStore.phase === "EXPLANATION"}
      <ExplanationPhase
        {tableScale}
        {tableOrigin}
        {tableBaseW}
        {tableBaseH}
        {phaseContainerClass}
        {sidePanelClass}
        deal={gameStore.deal}
        {userSeat}
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

    {#if DEV}
      <DebugDrawer open={appStore.debugPanelOpen} />
    {/if}
  </main>
{:else}
  <div class="flex items-center justify-center h-64">
    <p class="text-text-muted">Loading deal...</p>
  </div>
{/if}
