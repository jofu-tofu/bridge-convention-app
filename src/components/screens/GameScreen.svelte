<script lang="ts">
  import { Seat } from "../../engine/types";
  import type { Call } from "../../engine/types";
  import { getEngine, getGameStore, getAppStore } from "../../lib/context";
  import { startDrill } from "../../lib/drill-helpers";
  import { computeTableScale } from "../../lib/table-scale";
  import BridgeTable from "../game/BridgeTable.svelte";
  import AuctionTable from "../game/AuctionTable.svelte";
  import BidPanel from "../game/BidPanel.svelte";

  const engine = getEngine();
  const gameStore = getGameStore();
  const appStore = getAppStore();

  const userSeat = Seat.South;

  let dealNumber = $state(0);

  async function startNewDrill() {
    const convention = appStore.selectedConvention;
    if (!convention) return;
    dealNumber++;
    await startDrill(engine, convention, userSeat, gameStore);
  }

  let initialized = false;
  $effect(() => {
    if (!initialized) {
      initialized = true;
      startNewDrill().catch(console.error);
    }
  });

  $effect(() => {
    if (gameStore.phase === "EXPLANATION") {
      appStore.navigateToExplanation();
    }
  });

  function handleBid(call: Call) {
    gameStore.userBid(call);
  }

  // Responsive table scaling — use fallback values for SSR/jsdom
  let innerW = $state(1024);
  let innerH = $state(768);

  $effect(() => {
    if (typeof window !== "undefined") {
      innerW = window.innerWidth;
      innerH = window.innerHeight;
      const onResize = () => {
        innerW = window.innerWidth;
        innerH = window.innerHeight;
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
  });

  const isDesktop = $derived(innerW > 1023);
  const tableScale = $derived(computeTableScale(innerW, innerH, { sidePanel: isDesktop }));
</script>

{#if gameStore.deal}
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-3 border-b border-border-subtle">
      <div class="flex items-center gap-4">
        <button
          class="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
          onclick={() => appStore.navigateToMenu()}
          aria-label="Back to menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        </button>
        <h1 class="text-xl font-semibold text-text-primary">
          {appStore.selectedConvention?.name ?? "Drill"} Practice
        </h1>
      </div>
      <span class="text-text-secondary text-base">Deal #{dealNumber}</span>
    </div>

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
        <div class="{isDesktop ? 'w-[220px] border-l' : 'border-t'} border-border-subtle bg-bg-base p-4 space-y-4">
          <div>
            <h2 class="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">
              {#if gameStore.isUserTurn}
                Your bid
              {:else}
                Waiting...
              {/if}
            </h2>
            <BidPanel
              legalCalls={gameStore.legalCalls}
              onBid={handleBid}
              disabled={!gameStore.isUserTurn}
              compact
            />
          </div>
        </div>
      </div>
    {:else if gameStore.phase === "PLAYING"}
      <div class="flex-1 flex items-center justify-center">
        <div class="bg-bg-card rounded-[--radius-lg] p-6 text-center space-y-4">
          <p class="text-text-secondary">Card play coming in Phase 5</p>
          <button
            class="px-4 py-2 rounded-[--radius-md] bg-accent-primary hover:bg-accent-primary-hover text-white cursor-pointer transition-colors"
            onclick={() => appStore.navigateToExplanation()}
          >
            Continue to Review
          </button>
        </div>
      </div>
    {:else if gameStore.phase === "EXPLANATION"}
      <div class="flex-1 flex items-center justify-center">
        <p class="text-text-muted">Auction complete. Redirecting...</p>
      </div>
    {/if}
  </div>
{:else}
  <div class="flex items-center justify-center h-64">
    <p class="text-text-muted">Loading deal...</p>
  </div>
{/if}
