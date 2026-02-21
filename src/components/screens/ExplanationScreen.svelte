<script lang="ts">
  import { Seat } from "../../engine/types";
  import { getEngine, getGameStore, getAppStore } from "../../lib/context";
  import { startDrill } from "../../lib/drill-helpers";
  import { formatCall, STRAIN_SYMBOLS } from "../../lib/format";
  import BiddingReview from "../game/BiddingReview.svelte";
  import Button from "../shared/Button.svelte";

  const engine = getEngine();
  const gameStore = getGameStore();
  const appStore = getAppStore();

  const userSeat = Seat.South;

  async function handleNextDeal() {
    const convention = appStore.selectedConvention;
    if (!convention) return;
    appStore.navigateToGame();
    await startDrill(engine, convention, userSeat, gameStore);
  }
</script>

<div class="max-w-2xl mx-auto p-6 space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-bold text-text-primary">Bidding Review</h1>
    <div class="flex gap-3">
      <Button variant="secondary" onclick={() => appStore.navigateToMenu()}>
        Back to Menu
      </Button>
      <Button onclick={() => handleNextDeal()}>
        Next Deal
      </Button>
    </div>
  </div>

  {#if gameStore.contract}
    <div class="bg-bg-card rounded-[--radius-lg] p-4 border border-border-subtle">
      <h2 class="text-sm font-medium text-text-muted mb-1">Contract</h2>
      <p class="text-lg font-mono text-text-primary">
        {gameStore.contract.level}{STRAIN_SYMBOLS[gameStore.contract.strain]}
        {gameStore.contract.doubled ? " X" : ""}{gameStore.contract.redoubled ? " XX" : ""}
        by {gameStore.contract.declarer}
      </p>
    </div>
  {:else}
    <div class="bg-bg-card rounded-[--radius-lg] p-4 border border-border-subtle">
      <p class="text-text-muted">Passed out — no contract.</p>
    </div>
  {/if}

  <div class="bg-bg-card rounded-[--radius-lg] p-4 border border-border-subtle">
    <BiddingReview bidHistory={gameStore.bidHistory} />
  </div>
</div>
