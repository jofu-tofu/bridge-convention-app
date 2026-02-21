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

  async function startNewDrill() {
    const convention = appStore.selectedConvention;
    if (!convention) return;
    await startDrill(engine, convention, userSeat, gameStore);
  }

  let initialized = false;
  $effect(() => {
    if (!initialized) {
      initialized = true;
      startNewDrill();
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
      <h1 class="text-lg font-bold text-text-primary">
        {appStore.selectedConvention?.name ?? "Drill"}
      </h1>
      <button
        class="text-sm text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
        onclick={() => appStore.navigateToMenu()}
      >
        Back to Menu
      </button>
    </div>

    {#if gameStore.phase === "BIDDING"}
      <div class="flex-1 flex {isDesktop ? 'flex-row' : 'flex-col'} overflow-hidden">
        <!-- Table area -->
        <div class="flex-1 flex items-center justify-center p-4">
          <div style="transform: scale({tableScale}); transform-origin: center;">
            <BridgeTable
              hands={gameStore.deal.hands}
              {userSeat}
              dealer={gameStore.deal.dealer}
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
