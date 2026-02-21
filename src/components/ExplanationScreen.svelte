<script lang="ts">
  import { Seat } from "../engine/types";
  import { getEngine, getGameStore, getAppStore } from "../lib/context";
  import { createDrillConfig } from "../ai/drill-config-factory";
  import { createDrillSession } from "../ai/drill-session";
  import { formatCall } from "../lib/format";
  import BiddingReview from "./BiddingReview.svelte";

  const engine = getEngine();
  const gameStore = getGameStore();
  const appStore = getAppStore();

  const userSeat = Seat.South;

  async function handleNextDeal() {
    const convention = appStore.selectedConvention;
    if (!convention) return;

    const config = createDrillConfig(convention.id, userSeat);
    const session = createDrillSession(config);
    const deal = await engine.generateDeal(convention.dealConstraints);

    const initialAuction = convention.defaultAuction
      ? convention.defaultAuction(userSeat, deal)
      : undefined;

    appStore.navigateToGame();
    await gameStore.startDrill(deal, session, initialAuction);
  }
</script>

<div class="max-w-2xl mx-auto p-6 space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-bold text-gray-100">Bidding Review</h1>
    <div class="flex gap-3">
      <button
        class="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 cursor-pointer"
        onclick={() => appStore.navigateToMenu()}
      >
        Back to Menu
      </button>
      <button
        class="text-sm px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-gray-200 cursor-pointer"
        onclick={() => handleNextDeal()}
      >
        Next Deal
      </button>
    </div>
  </div>

  {#if gameStore.contract}
    <div class="bg-gray-800 rounded-lg p-4">
      <h2 class="text-sm font-medium text-gray-400 mb-1">Contract</h2>
      <p class="text-lg font-mono text-gray-200">
        {gameStore.contract.level}{gameStore.contract.strain}
        {gameStore.contract.doubled ? " X" : ""}{gameStore.contract.redoubled ? " XX" : ""}
        by {gameStore.contract.declarer}
      </p>
    </div>
  {:else}
    <div class="bg-gray-800 rounded-lg p-4">
      <p class="text-gray-400">Passed out — no contract.</p>
    </div>
  {/if}

  <div class="bg-gray-800 rounded-lg p-4">
    <BiddingReview bidHistory={gameStore.bidHistory} />
  </div>
</div>
