<script lang="ts">
  import { Seat } from "../../engine/types";
  import { getEngine, getGameStore, getAppStore } from "../../lib/context";
  import { startDrill } from "../../lib/drill-helpers";
  import { STRAIN_SYMBOLS } from "../../lib/format";
  import BiddingReview from "../game/BiddingReview.svelte";
  import Button from "../shared/Button.svelte";

  const engine = getEngine();
  const gameStore = getGameStore();
  const appStore = getAppStore();

  const userSeat = Seat.South;

  async function handleNextDeal() {
    const convention = appStore.selectedConvention;
    if (!convention) return;
    // Start drill BEFORE navigating so phase is BIDDING when GameScreen mounts
    await startDrill(engine, convention, userSeat, gameStore);
    appStore.navigateToGame();
  }

  /** Format contract result like "3NT making 4 — +430" or "2H down 1 — -100" */
  function formatResult(): string | null {
    if (!gameStore.contract || gameStore.score === null) return null;
    const c = gameStore.contract;
    const required = c.level + 6;
    const totalTricks = gameStore.declarerTricksWon;
    const scoreVal = gameStore.score;
    const contractStr = `${c.level}${STRAIN_SYMBOLS[c.strain]}${c.doubled ? "X" : ""}${c.redoubled ? "XX" : ""}`;

    if (totalTricks >= required) {
      const over = totalTricks - required;
      const trickStr = over === 0 ? "=" : `+${over}`;
      return `${contractStr} by ${c.declarer} ${trickStr} — ${scoreVal >= 0 ? "+" : ""}${scoreVal}`;
    } else {
      const down = required - totalTricks;
      return `${contractStr} by ${c.declarer} -${down} — ${scoreVal}`;
    }
  }
</script>

<main class="max-w-2xl mx-auto p-6 flex flex-col gap-6" aria-label="Bidding explanation">
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-bold text-text-primary">Bidding Review</h1>
    <div class="flex gap-3">
      <Button variant="secondary" onclick={() => { gameStore.reset(); appStore.navigateToMenu(); }}>
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
      {#if gameStore.score !== null}
        {@const result = formatResult()}
        {#if result}
          <p class="text-base font-mono mt-2 {gameStore.score >= 0 ? 'text-green-400' : 'text-red-400'}" data-testid="score-result">
            {result}
          </p>
        {/if}
      {/if}
    </div>
  {:else}
    <div class="bg-bg-card rounded-[--radius-lg] p-4 border border-border-subtle">
      <p class="text-text-muted">Passed out — no contract.</p>
    </div>
  {/if}

  <div class="bg-bg-card rounded-[--radius-lg] p-4 border border-border-subtle">
    <BiddingReview bidHistory={gameStore.bidHistory} />
  </div>
</main>
