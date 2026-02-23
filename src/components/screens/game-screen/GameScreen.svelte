<script lang="ts">
  import { onMount } from "svelte";
  import { Seat } from "../../../engine/types";
  import type { Call, Card as CardType } from "../../../engine/types";
  import { getEngine, getGameStore, getAppStore } from "../../../lib/context";
  import { startDrill } from "../../../lib/drill-helpers";
  import { computeTableScale } from "../../../lib/table-scale";
  import { mulberry32 } from "../../../lib/seeded-rng";
  import { seatController } from "../../../stores/game.svelte";
  import { partnerSeat } from "../../../engine/constants";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";
  import HandFan from "../../game/HandFan.svelte";
  import TrickArea from "../../game/TrickArea.svelte";
  import DeclarerPrompt from "../../game/DeclarerPrompt.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import BiddingSidePanel from "./BiddingSidePanel.svelte";
  import PlaySidePanel from "./PlaySidePanel.svelte";
  import ReviewSidePanel from "./ReviewSidePanel.svelte";
  import DebugDrawer from "../../game/DebugDrawer.svelte";

  const DEV = import.meta.env.DEV;

  const engine = getEngine();
  const gameStore = getGameStore();
  const appStore = getAppStore();

  const userSeat = Seat.South;

  let dealNumber = $state(0);
  let playLegalPlays = $state<CardType[]>([]);
  let showAllCards = $state(false);

  // Table rotation: only when effectiveUserSeat is exactly North (declarer swap accepted)
  const rotated = $derived(gameStore.effectiveUserSeat === Seat.North);
  // Effective seat for play phase (effectiveUserSeat after swap, or default userSeat)
  const playUserSeat = $derived(gameStore.effectiveUserSeat ?? userSeat);

  function makeDevRng(): (() => number) | undefined {
    if (appStore.devSeed == null) return undefined;
    const seed = appStore.devSeed + appStore.devDealCount;
    appStore.advanceDevDeal();
    return mulberry32(seed);
  }

  async function startNewDrill() {
    const convention = appStore.selectedConvention;
    if (!convention) return;
    dealNumber++;
    await startDrill(engine, convention, userSeat, gameStore, makeDevRng());
  }

  onMount(() => {
    // Skip if a deal is already in progress
    if (gameStore.deal && gameStore.phase === "BIDDING") {
      dealNumber++;
      return;
    }
    startNewDrill().catch(console.error);
  });

  async function handleNextDeal() {
    const convention = appStore.selectedConvention;
    if (!convention) return;
    showAllCards = false;
    dealNumber++;
    await startDrill(engine, convention, userSeat, gameStore, makeDevRng());
  }

  // Update legal plays for current player during play phase
  $effect(() => {
    const player = gameStore.currentPlayer;
    if (gameStore.phase === "PLAYING" && player) {
      gameStore.getLegalPlaysForSeat(player).then((plays) => {
        // Only update if player hasn't changed since the request
        if (gameStore.currentPlayer === player) {
          playLegalPlays = plays;
        }
      });
    } else {
      playLegalPlays = [];
    }
  });

  function handleBid(call: Call) {
    gameStore.userBid(call);
  }

  function handlePlayCard(card: CardType, seat: Seat) {
    gameStore.userPlayCard(card, seat);
  }

  // Compute user-controlled seats for play phase (uses effectiveUserSeat after swap)
  const userControlledSeats = $derived.by(() => {
    if (!gameStore.contract) return [playUserSeat];
    const seats: Seat[] = [playUserSeat];
    const dummy = partnerSeat(gameStore.contract.declarer);
    if (
      seatController(dummy, gameStore.contract.declarer, playUserSeat) ===
      "user"
    ) {
      seats.push(dummy);
    }
    return seats;
  });

  // Remaining cards per seat during play
  const remainingCards = $derived.by(() => {
    if (gameStore.phase !== "PLAYING" || !gameStore.deal) return undefined;
    const result: Partial<Record<Seat, readonly CardType[]>> = {};
    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      result[seat] = gameStore.getRemainingCards(seat);
    }
    return result;
  });

  // Phase display info
  const phaseInfo = $derived.by(() => {
    if (gameStore.phase === "BIDDING") {
      return {
        label: "Bidding",
        color: "bg-blue-600",
        textColor: "text-blue-100",
      };
    }
    if (gameStore.phase === "DECLARER_PROMPT") {
      if (gameStore.isDefenderPrompt) {
        return {
          label: "Defend",
          color: "bg-amber-600",
          textColor: "text-amber-100",
        };
      }
      return {
        label: "Declarer",
        color: "bg-teal-600",
        textColor: "text-teal-100",
      };
    }
    if (gameStore.phase === "PLAYING") {
      return {
        label: "Playing",
        color: "bg-amber-600",
        textColor: "text-amber-100",
      };
    }
    return {
      label: "Review",
      color: "bg-purple-600",
      textColor: "text-purple-100",
    };
  });

  // Whether feedback is showing and blocking input
  const isFeedbackBlocking = $derived(
    gameStore.bidFeedback !== null && !gameStore.bidFeedback.isCorrect,
  );

  // Responsive table scaling — measure actual available space
  let innerW = $state(1024);
  let innerH = $state(768);
  let headerH = $state(0);

  // Derive root font size from viewport to match CSS: clamp(16px, 1.5vw, 28px)
  const rootFontSize = $derived(Math.min(28, Math.max(16, innerW * 0.015)));
  const tableBaseW = 800; // --spacing-table-width (px, scaled by CSS transform)
  const tableBaseH = 650; // --spacing-table-height (px, scaled by CSS transform)
  // Match CSS: clamp(16rem, 25vw, 25rem)
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
    `${isDesktop ? "" : "border-t border-border-subtle"} bg-bg-base p-4 flex flex-col gap-4 min-h-0 overflow-hidden`,
  );

  function handleBackToMenu() {
    gameStore.reset();
    appStore.navigateToMenu();
  }
</script>

<svelte:window bind:innerWidth={innerW} bind:innerHeight={innerH} />

{#if gameStore.deal}
  <main class="h-full flex flex-col" aria-label="Bridge drill">
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
          aria-label="Current phase: {phaseInfo.label}"
          data-testid="game-phase"
        >
          {phaseInfo.label}
        </span>
      </div>
      <div class="flex items-center gap-3">
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

    {#if gameStore.phase === "BIDDING"}
      <div
        class={phaseContainerClass}
      >
        <ScaledTableArea scale={tableScale} origin={tableOrigin} tableWidth={tableBaseW} tableHeight={tableBaseH}>
          <BridgeTable hands={gameStore.deal.hands} {userSeat}>
            <div
              class="bg-bg-card rounded-[--radius-lg] p-3 border border-border-subtle shadow-md"
            >
              <AuctionTable
                entries={gameStore.auction.entries}
                dealer={gameStore.deal.dealer}
                compact
              />
            </div>
          </BridgeTable>
        </ScaledTableArea>

        <aside class={sidePanelClass} aria-label="Bidding controls">
          <BiddingSidePanel
            legalCalls={gameStore.legalCalls}
            onBid={handleBid}
            disabled={!gameStore.isUserTurn ||
              isFeedbackBlocking ||
              !!gameStore.bidFeedback}
            isUserTurn={gameStore.isUserTurn}
            bidFeedback={gameStore.bidFeedback}
            {isFeedbackBlocking}
            onDismissFeedback={() => gameStore.dismissBidFeedback()}
            onSkipToReview={() => gameStore.skipFromFeedback()}
            onRetry={() => gameStore.retryBid()}
            convention={DEV ? appStore.selectedConvention : undefined}
            hand={DEV ? gameStore.deal.hands[userSeat] : undefined}
            auction={DEV ? gameStore.auction : undefined}
            seat={DEV ? userSeat : undefined}
          />
        </aside>
      </div>
    {:else if gameStore.phase === "DECLARER_PROMPT"}
      <!-- Show normal view with dummy (North) face-up; rotation happens on accept -->
      <div
        class={phaseContainerClass}
      >
        <ScaledTableArea scale={tableScale} origin={tableOrigin} tableWidth={tableBaseW} tableHeight={tableBaseH}>
          <BridgeTable
            hands={gameStore.deal.hands}
            {userSeat}
            dummySeat={gameStore.isDefenderPrompt
              ? partnerSeat(gameStore.contract?.declarer ?? userSeat)
              : gameStore.isSouthDeclarerPrompt
                ? partnerSeat(gameStore.contract?.declarer ?? userSeat)
                : gameStore.contract?.declarer}
          >
            {#if gameStore.contract}
              <DeclarerPrompt
                contract={gameStore.contract}
                {userSeat}
                mode={gameStore.isDefenderPrompt
                  ? "defender"
                  : gameStore.isSouthDeclarerPrompt
                    ? "south-declarer"
                    : "declarer-swap"}
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
            {/if}
          </BridgeTable>
        </ScaledTableArea>

        <aside class={sidePanelClass} aria-label="Auction summary">
          <div
            class="bg-bg-card rounded-[--radius-lg] p-3 border border-border-subtle shadow-md"
          >
            <AuctionTable
              entries={gameStore.auction.entries}
              dealer={gameStore.deal.dealer}
              compact
            />
          </div>
        </aside>
      </div>
    {:else if gameStore.phase === "PLAYING"}
      <div
        class={phaseContainerClass}
      >
        <ScaledTableArea scale={tableScale} origin={tableOrigin} tableWidth={tableBaseW} tableHeight={tableBaseH}>
          <BridgeTable
            hands={gameStore.deal.hands}
            userSeat={playUserSeat}
            dummySeat={gameStore.dummySeat ?? undefined}
            legalPlays={playLegalPlays}
            onPlayCard={handlePlayCard}
            currentPlayer={gameStore.currentPlayer ?? undefined}
            {userControlledSeats}
            {remainingCards}
            {rotated}
          >
            <TrickArea
              currentTrick={gameStore.currentTrick}
              currentPlayer={gameStore.currentPlayer}
              trumpSuit={gameStore.trumpSuit}
              {rotated}
            />
          </BridgeTable>
        </ScaledTableArea>

        <aside class={sidePanelClass} aria-label="Play controls">
          <PlaySidePanel
            contract={gameStore.contract}
            declarerTricksWon={gameStore.declarerTricksWon}
            defenderTricksWon={gameStore.defenderTricksWon}
            onSkipToReview={() => gameStore.skipToReview()}
          />
        </aside>
      </div>
    {:else if gameStore.phase === "EXPLANATION"}
      <div
        class={phaseContainerClass}
      >
        {#if showAllCards}
          <div class="flex-1 flex flex-col gap-3 p-4 overflow-auto min-w-0">
            <div class="flex items-center justify-between">
              <div
                class="bg-bg-card rounded-[--radius-lg] p-2 border border-border-subtle shadow-md"
              >
                <AuctionTable
                  entries={gameStore.auction.entries}
                  dealer={gameStore.deal.dealer}
                  compact
                />
              </div>
              <button
                type="button"
                class="text-sm text-text-primary hover:text-blue-300 transition-colors px-3 py-2 min-h-[--size-touch-target] rounded-[--radius-md] border border-border-subtle bg-bg-card/80 shrink-0"
                onclick={() => (showAllCards = !showAllCards)}
                aria-expanded={showAllCards}
                aria-label="Toggle all hands visibility"
              >
                Hide Hands
              </button>
            </div>
            <div
              class="grid grid-cols-2 gap-3"
              style="--card-overlap-h: -38px;"
            >
              {#each [Seat.North, Seat.East, Seat.South, Seat.West] as seat (seat)}
                <section
                  class="bg-bg-card rounded-[--radius-lg] p-3 border border-border-subtle"
                  aria-label="{seat} hand"
                >
                  <div class="flex items-center gap-2 mb-2">
                    <span
                      class="text-sm font-bold tracking-wide px-2 py-0.5 rounded {seat ===
                      userSeat
                        ? 'bg-blue-600/30 text-blue-200'
                        : 'bg-bg-elevated text-text-primary'}"
                    >
                      {seat}
                    </span>
                  </div>
                  <HandFan cards={gameStore.deal.hands[seat].cards} faceUp />
                </section>
              {/each}
            </div>
          </div>
        {:else}
          <ScaledTableArea scale={tableScale} origin={tableOrigin} tableWidth={tableBaseW} tableHeight={tableBaseH}>
            <BridgeTable hands={gameStore.deal.hands} {userSeat}>
              <div class="flex flex-col gap-2 items-center">
                <div
                  class="bg-bg-card rounded-[--radius-lg] p-3 border border-border-subtle shadow-md"
                >
                  <AuctionTable
                    entries={gameStore.auction.entries}
                    dealer={gameStore.deal.dealer}
                    compact
                  />
                </div>
                <button
                  type="button"
                  class="text-sm text-text-primary hover:text-blue-300 transition-colors px-3 py-2 min-h-[--size-touch-target] rounded-[--radius-md] border border-border-subtle bg-bg-card/80"
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

        <aside class={sidePanelClass} aria-label="Review panel">
          <ReviewSidePanel
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
            deal={gameStore.deal ?? undefined}
          />
        </aside>
      </div>
    {/if}

    {#if DEV}
      <DebugDrawer open={appStore.debugPanelOpen} />
    {/if}
  </main>
{:else}
  <div class="flex items-center justify-center h-64">
    <p class="text-text-muted">Loading deal...</p>
  </div>
{/if}
