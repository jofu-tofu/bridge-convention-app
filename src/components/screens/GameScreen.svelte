<script lang="ts">
  import { onMount } from "svelte";
  import { Seat } from "../../engine/types";
  import type { Call, Card as CardType } from "../../engine/types";
  import { getEngine, getGameStore, getAppStore } from "../../lib/context";
  import { startDrill } from "../../lib/drill-helpers";
  import { computeTableScale } from "../../lib/table-scale";
  import { seatController } from "../../stores/game.svelte";
  import { STRAIN_SYMBOLS } from "../../lib/format";
  import { partnerSeat } from "../../engine/constants";
  import BridgeTable from "../game/BridgeTable.svelte";
  import AuctionTable from "../game/AuctionTable.svelte";
  import TrickArea from "../game/TrickArea.svelte";
  import BidPanel from "../game/BidPanel.svelte";
  import BidFeedbackPanel from "../game/BidFeedbackPanel.svelte";
  import Button from "../shared/Button.svelte";
  import DebugPanel from "../game/DebugPanel.svelte";

  const DEV = import.meta.env.DEV;

  const engine = getEngine();
  const gameStore = getGameStore();
  const appStore = getAppStore();

  const userSeat = Seat.South;

  let dealNumber = $state(0);
  let playLegalPlays = $state<CardType[]>([]);

  async function startNewDrill() {
    const convention = appStore.selectedConvention;
    if (!convention) return;
    dealNumber++;
    await startDrill(engine, convention, userSeat, gameStore);
  }

  onMount(() => {
    // Skip if a deal is already in progress (e.g., started by ExplanationScreen's Next Deal)
    if (gameStore.deal && gameStore.phase === "BIDDING") {
      dealNumber++;
      return;
    }
    startNewDrill().catch(console.error);
  });

  $effect(() => {
    if (gameStore.phase === "EXPLANATION") {
      appStore.navigateToExplanation();
    }
  });

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

  // Compute user-controlled seats for play phase
  const userControlledSeats = $derived.by(() => {
    if (!gameStore.contract) return [userSeat];
    const seats: Seat[] = [userSeat];
    const dummy = partnerSeat(gameStore.contract.declarer);
    if (seatController(dummy, gameStore.contract.declarer, userSeat) === "user") {
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
      return { label: "Bidding", color: "bg-blue-600", textColor: "text-blue-100" };
    }
    if (gameStore.phase === "PLAYING") {
      return { label: "Playing", color: "bg-amber-600", textColor: "text-amber-100" };
    }
    return { label: "Review", color: "bg-purple-600", textColor: "text-purple-100" };
  });

  // Whether feedback is showing and blocking input
  const isFeedbackBlocking = $derived(
    gameStore.bidFeedback !== null && !gameStore.bidFeedback.isCorrect
  );

  // Responsive table scaling — use fallback values for SSR/jsdom
  let innerW = $state(1024);
  let innerH = $state(768);

  const isDesktop = $derived(innerW > 1023);
  const tableScale = $derived(computeTableScale(innerW, innerH, { sidePanel: isDesktop }));
</script>

<svelte:window bind:innerWidth={innerW} bind:innerHeight={innerH} />

{#if gameStore.deal}
  <main class="h-full flex flex-col" aria-label="Bridge drill">
    <!-- Header -->
    <header class="flex items-center justify-between px-6 py-3 border-b border-border-subtle">
      <div class="flex items-center gap-4">
        <button
          class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
          onclick={() => { gameStore.reset(); appStore.navigateToMenu(); }}
          aria-label="Back to menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        </button>
        <h1 class="text-xl font-semibold text-text-primary">
          {appStore.selectedConvention?.name ?? "Drill"} Practice
        </h1>
        <!-- Phase indicator -->
        <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold {phaseInfo.color} {phaseInfo.textColor}">
          {phaseInfo.label}
        </span>
      </div>
      <span class="text-text-secondary text-base">Deal #{dealNumber}</span>
    </header>

    {#if gameStore.phase === "BIDDING"}
      <div class="flex-1 flex {isDesktop ? 'flex-row' : 'flex-col'} overflow-hidden">
        <!-- Table area -->
        <div class="flex-1 flex items-center justify-center p-4">
          <div style="transform: scale({tableScale}); transform-origin: center;">
            <BridgeTable
              hands={gameStore.deal.hands}
              {userSeat}
            >
              <div class="bg-bg-card rounded-[--radius-lg] p-3 border border-border-subtle shadow-md">
                <AuctionTable
                  entries={gameStore.auction.entries}
                  dealer={gameStore.deal.dealer}
                  compact
                />
              </div>
            </BridgeTable>
          </div>
        </div>

        <!-- Side panel -->
        <div class="{isDesktop ? 'w-[--width-side-panel] border-l' : 'border-t'} border-border-subtle bg-bg-base p-4 flex flex-col gap-4 overflow-y-auto">
          {#if gameStore.bidFeedback}
            <!-- Bid feedback takes priority over bid panel -->
            <BidFeedbackPanel
              feedback={gameStore.bidFeedback}
              onContinue={() => gameStore.dismissBidFeedback()}
              onSkipToReview={() => gameStore.skipFromFeedback()}
            />
          {:else}
            <div>
              <h2 class="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider" aria-live="polite">
                {#if gameStore.isUserTurn}
                  Your bid
                {:else}
                  Waiting...
                {/if}
              </h2>
              <BidPanel
                legalCalls={gameStore.legalCalls}
                onBid={handleBid}
                disabled={!gameStore.isUserTurn || isFeedbackBlocking}
                compact
              />
            </div>
          {/if}
          {#if DEV && appStore.selectedConvention && !gameStore.bidFeedback}
            <div class="mt-auto">
              <DebugPanel
                convention={appStore.selectedConvention}
                hand={gameStore.deal.hands[userSeat]}
                auction={gameStore.auction}
                seat={userSeat}
              />
            </div>
          {/if}
        </div>
      </div>
    {:else if gameStore.phase === "PLAYING"}
      <div class="flex-1 flex {isDesktop ? 'flex-row' : 'flex-col'} overflow-hidden">
        <!-- Table area -->
        <div class="flex-1 flex items-center justify-center p-4">
          <div style="transform: scale({tableScale}); transform-origin: center;">
            <BridgeTable
              hands={gameStore.deal.hands}
              {userSeat}
              dummySeat={gameStore.dummySeat ?? undefined}
              legalPlays={playLegalPlays}
              onPlayCard={handlePlayCard}
              currentPlayer={gameStore.currentPlayer ?? undefined}
              {userControlledSeats}
              {remainingCards}
            >
              <TrickArea
                currentTrick={gameStore.currentTrick}
                currentPlayer={gameStore.currentPlayer}
                trumpSuit={gameStore.trumpSuit}
                declarerTricksWon={gameStore.declarerTricksWon}
                defenderTricksWon={gameStore.defenderTricksWon}
              />
            </BridgeTable>
          </div>
        </div>

        <!-- Side panel -->
        <div class="{isDesktop ? 'w-[--width-side-panel] border-l' : 'border-t'} border-border-subtle bg-bg-base p-4 flex flex-col gap-4 overflow-y-auto">
          {#if gameStore.contract}
            <section class="bg-bg-card rounded-[--radius-lg] p-3 border border-border-subtle">
              <h2 class="text-xs font-medium text-text-muted mb-1 uppercase tracking-wider">Contract</h2>
              <p class="text-lg font-mono text-text-primary">
                {gameStore.contract.level}{STRAIN_SYMBOLS[gameStore.contract.strain]}
                {gameStore.contract.doubled ? " X" : ""}{gameStore.contract.redoubled ? " XX" : ""}
                by {gameStore.contract.declarer}
              </p>
            </section>
          {/if}

          <section class="bg-bg-card rounded-[--radius-lg] p-3 border border-border-subtle">
            <h2 class="text-xs font-medium text-text-muted mb-1 uppercase tracking-wider">Tricks</h2>
            <div class="flex gap-4 text-lg font-mono text-text-primary">
              <span>Decl: {gameStore.declarerTricksWon}</span>
              <span>Def: {gameStore.defenderTricksWon}</span>
            </div>
          </section>

          <div class="mt-auto">
            <Button variant="secondary" onclick={() => gameStore.skipToReview()}>
              Skip to Review
            </Button>
          </div>
        </div>
      </div>
    {:else if gameStore.phase === "EXPLANATION"}
      <div class="flex-1 flex items-center justify-center">
        <p class="text-text-muted">Auction complete. Redirecting...</p>
      </div>
    {/if}
  </main>
{:else}
  <div class="flex items-center justify-center h-64">
    <p class="text-text-muted">Loading deal...</p>
  </div>
{/if}
