<script lang="ts">
  import { Seat } from "../engine/types";
  import { getEngine, getGameStore, getAppStore } from "../lib/context";
  import { createDrillConfig } from "../ai/drill-config-factory";
  import { createDrillSession } from "../ai/drill-session";
  import HandDisplay from "./HandDisplay.svelte";
  import AuctionTable from "./AuctionTable.svelte";
  import BidPanel from "./BidPanel.svelte";

  const engine = getEngine();
  const gameStore = getGameStore();
  const appStore = getAppStore();

  const userSeat = Seat.South;

  async function startNewDrill() {
    const convention = appStore.selectedConvention;
    if (!convention) return;

    const config = createDrillConfig(convention.id, userSeat);
    const session = createDrillSession(config);
    const deal = await engine.generateDeal(convention.dealConstraints);

    const initialAuction = convention.defaultAuction
      ? convention.defaultAuction(userSeat, deal)
      : undefined;

    await gameStore.startDrill(deal, session, initialAuction);
  }

  let initialized = false;
  $effect(() => {
    if (!initialized) {
      initialized = true;
      startNewDrill();
    }
  });

  // Auto-navigate to explanation when auction completes
  $effect(() => {
    if (gameStore.phase === "EXPLANATION") {
      appStore.navigateToExplanation();
    }
  });

  function handleBid(call: import("../engine/types").Call) {
    gameStore.userBid(call);
  }
</script>

{#if gameStore.deal}
  <div class="max-w-2xl mx-auto p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-100">
        {appStore.selectedConvention?.name ?? "Drill"}
      </h1>
      <button
        class="text-sm text-gray-400 hover:text-gray-200 cursor-pointer"
        onclick={() => appStore.navigateToMenu()}
      >
        Back to Menu
      </button>
    </div>

    {#if gameStore.phase === "BIDDING"}
      <div class="space-y-4">
        <div class="bg-gray-800 rounded-lg p-4">
          <h2 class="text-sm font-medium text-gray-400 mb-2">Your Hand ({userSeat})</h2>
          <HandDisplay hand={gameStore.deal.hands[userSeat]} />
        </div>

        <div class="bg-gray-800 rounded-lg p-4">
          <h2 class="text-sm font-medium text-gray-400 mb-2">Auction</h2>
          <AuctionTable entries={gameStore.auction.entries} dealer={gameStore.deal.dealer} />
        </div>

        <div class="bg-gray-800 rounded-lg p-4">
          <h2 class="text-sm font-medium text-gray-400 mb-2">
            {#if gameStore.isUserTurn}
              Your bid:
            {:else}
              Waiting...
            {/if}
          </h2>
          <BidPanel
            legalCalls={gameStore.legalCalls}
            onBid={handleBid}
            disabled={!gameStore.isUserTurn}
          />
        </div>
      </div>
    {:else if gameStore.phase === "PLAYING"}
      <!-- TODO Phase 5: Replace stub with card play UI -->
      <div class="bg-gray-800 rounded-lg p-6 text-center space-y-4">
        <p class="text-gray-300">Card play coming in Phase 5</p>
        <button
          class="px-4 py-2 rounded bg-blue-700 hover:bg-blue-600 text-gray-200 cursor-pointer"
          onclick={() => appStore.navigateToExplanation()}
        >
          Continue to Review
        </button>
      </div>
    {:else if gameStore.phase === "EXPLANATION"}
      <!-- Auction complete — auto-navigate to explanation -->
      <div class="text-center p-6">
        <p class="text-gray-400">Auction complete. Redirecting...</p>
      </div>
    {/if}
  </div>
{:else}
  <div class="flex items-center justify-center h-64">
    <p class="text-gray-500">Loading deal...</p>
  </div>
{/if}
