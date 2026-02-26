<script lang="ts">
  import { Seat } from "../../../engine/types";
  import type { Contract, DDSolution, Vulnerability, Deal } from "../../../engine/types";
  import type { Auction } from "../../../engine/types";
  import type { ConventionConfig } from "../../../conventions/core/types";
  import type { BidHistoryEntry } from "../../../stores/game.svelte";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";
  import HandFan from "../../game/HandFan.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import ReviewSidePanel from "./ReviewSidePanel.svelte";
  import type { LayoutProps } from "./layout-props";

  interface Props extends LayoutProps {
    deal: Deal;
    userSeat: Seat;
    auction: Auction;
    contract: Contract | null;
    score: number | null;
    declarerTricksWon: number;
    bidHistory: BidHistoryEntry[];
    ddsSolution: DDSolution | null;
    ddsSolving: boolean;
    ddsError: string | null;
    vulnerability: Vulnerability;
    dealNumber: number;
    onNextDeal: () => void;
    onBackToMenu: () => void;
    onPlayHand?: (() => void) | undefined;
    convention?: ConventionConfig | undefined;
  }

  const {
    tableScale,
    tableOrigin,
    tableBaseW,
    tableBaseH,
    phaseContainerClass,
    sidePanelClass,
    deal,
    userSeat,
    auction,
    contract,
    score,
    declarerTricksWon,
    bidHistory,
    ddsSolution,
    ddsSolving,
    ddsError,
    vulnerability,
    dealNumber,
    onNextDeal,
    onBackToMenu,
    onPlayHand,
    convention,
  }: Props = $props();

  let showAllCards = $state(false);
</script>

<div class={phaseContainerClass}>
  {#if showAllCards}
    <div class="flex-1 flex flex-col gap-3 p-4 overflow-auto min-w-0">
      <div class="flex items-center justify-between">
        <div
          class="bg-bg-card rounded-[--radius-lg] p-2 border border-border-subtle shadow-md"
        >
          <AuctionTable
            entries={auction.entries}
            dealer={deal.dealer}
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
            <HandFan cards={deal.hands[seat].cards} faceUp />
          </section>
        {/each}
      </div>
    </div>
  {:else}
    <ScaledTableArea scale={tableScale} origin={tableOrigin} tableWidth={tableBaseW} tableHeight={tableBaseH}>
      <BridgeTable hands={deal.hands} {userSeat}>
        <div class="flex flex-col gap-2 items-center">
          <div
            class="bg-bg-card rounded-[--radius-lg] p-3 border border-border-subtle shadow-md"
          >
            <AuctionTable
              entries={auction.entries}
              dealer={deal.dealer}
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
      {contract}
      {score}
      {declarerTricksWon}
      {bidHistory}
      {ddsSolution}
      {ddsSolving}
      {ddsError}
      {vulnerability}
      {dealNumber}
      {onNextDeal}
      {onBackToMenu}
      {onPlayHand}
      {convention}
      {deal}
    />
  </aside>
</div>
