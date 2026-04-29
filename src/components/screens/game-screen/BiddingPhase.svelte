<script lang="ts">
  import type { BiddingViewport } from "../../../service";
  import { getGameStore, getLayoutConfig } from "../../../stores/context";
  import { getAppStore } from "../../../stores/context";
  import { PHASE_CONTAINER_CLASS, PANEL_FONT_STYLE, SIDE_PANEL_CLASS } from "../../shared/layout-props";
  import { DESKTOP_MIN } from "../../shared/breakpoints.svelte";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";
  import HandFan from "../../game/HandFan.svelte";
  import BidPanel from "../../game/BidPanel.svelte";
  import BidFeedbackPanel from "../../game/bid-feedback/BidFeedbackPanel.svelte";
  import Spinner from "../../shared/Spinner.svelte";
  import SectionHeader from "../../shared/SectionHeader.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import BiddingSidePanel from "./BiddingSidePanel.svelte";
  import { buildContextSummary } from "./context-banner";
  import { Seat } from "../../../service";

  interface Props {
    viewport: BiddingViewport;
    onNewDeal: () => void;
  }

  const {
    viewport,
    onNewDeal,
  }: Props = $props();

  const layout = getLayoutConfig();
  const appStore = getAppStore();
  const gameStore = getGameStore();

  const contextSummary = $derived(buildContextSummary(viewport));
  const southHand = $derived(viewport.visibleHands[Seat.South]);

  let windowW = $state(DESKTOP_MIN);
  const isDesktop = $derived(windowW >= DESKTOP_MIN);

  // Mobile-only: size the South fan to fit its container width.
  // Fan total width ≈ cardW + 12 * (cardW + overlap). With overlap = -0.4*cardW,
  // total ≈ 8.2 * cardW, so cardW ≈ containerW / 8.2.
  let mobileFanContainerW = $state(360);
  const mobileCardW = $derived(Math.max(32, Math.min(56, Math.floor(mobileFanContainerW / 8.2))));
  const mobileCardH = $derived(Math.round(mobileCardW * (98 / 70)));
  const mobileCardOverlapH = $derived(-Math.round(mobileCardW * 0.4));
  const mobileFanStyle = $derived(
    `--card-width: ${mobileCardW}px; --card-height: ${mobileCardH}px; --card-overlap-h: ${mobileCardOverlapH}px;`,
  );

  const disabled = $derived(!gameStore.isUserTurn || gameStore.isFeedbackBlocking);
  const hasFeedback = $derived(gameStore.viewportFeedback !== null);
</script>

<svelte:window bind:innerWidth={windowW} />

{#if contextSummary}
  <div class="px-4 py-1 lg:py-2 bg-bg-card/50 border-b border-border-subtle text-text-secondary text-[--text-detail] shrink-0">
    {contextSummary}
  </div>
{/if}

{#if isDesktop}
  <div class={PHASE_CONTAINER_CLASS}>
    <ScaledTableArea scale={layout.tableScale} origin={layout.tableOrigin} tableWidth={layout.tableBaseW} tableHeight={layout.tableBaseH}>
      <BridgeTable visibleHands={viewport.visibleHands} handEvaluation={viewport.handEvaluation} vulnerability={viewport.vulnerability}>
        <div
          class="relative bg-bg-card rounded-[--radius-lg] p-3 border border-border-subtle shadow-md z-[var(--z-tooltip)]"
        >
          <AuctionTable
            entries={gameStore.auction.entries}
            dealer={viewport.dealer}
            bidHistory={gameStore.bidHistory}
            showEducationalAnnotations={appStore.displaySettings.showEducationalAnnotations}
            compact
          />
        </div>
      </BridgeTable>
    </ScaledTableArea>

    <aside class={SIDE_PANEL_CLASS} style={PANEL_FONT_STYLE} aria-label="Bidding controls">
      <BiddingSidePanel
        {onNewDeal}
        lifecycleDisabled={gameStore.isTransitioning}
      />
    </aside>
  </div>
{:else}
  <!-- Mobile: auction + South fan + BidPanel stack, no bridge table.
       pb-14 reserves space for the sticky BottomTabBar which overlays the
       bottom 56px of shell-main. -->
  <div class="flex-1 flex flex-col min-h-0 overflow-hidden pb-14" aria-label="Bidding controls">
    <div class="shrink-0 relative bg-bg-card border-b border-border-subtle px-3 py-1">
      <AuctionTable
        entries={gameStore.auction.entries}
        dealer={viewport.dealer}
        bidHistory={gameStore.bidHistory}
        showEducationalAnnotations={appStore.displaySettings.showEducationalAnnotations}
        compact
      />
    </div>

    <div class="flex-1 min-h-0 flex flex-col items-center justify-center gap-1 overflow-hidden" bind:clientWidth={mobileFanContainerW}>
      <div class="flex items-center gap-2 text-[--text-label]">
        <span
          class="seat-badge font-bold bg-bg-elevated/80 text-text-secondary px-2 py-0.5 rounded-full"
          data-testid="seat-label-{Seat.South}"
        >S</span>
        <span
          class="text-text-secondary bg-bg-elevated/60 px-1.5 py-0.5 rounded-full"
          data-testid="south-hcp"
        >{viewport.handEvaluation.hcp} HCP</span>
      </div>
      <div style={mobileFanStyle}>
        {#if southHand}
          <HandFan cards={southHand.cards} faceUp />
        {/if}
      </div>
    </div>

    <div class="shrink-0 flex flex-col border-t border-border-subtle bg-bg-base px-3 py-2 gap-1.5">
      <SectionHeader ariaLive="polite">
        {#if gameStore.isUserTurn || hasFeedback}
          Your bid
        {:else}
          Waiting...
        {/if}
      </SectionHeader>
      {#if hasFeedback}
        <div class="max-h-[40vh] overflow-y-auto overflow-x-hidden">
          <BidFeedbackPanel
            feedback={gameStore.viewportFeedback!}
            teaching={gameStore.teachingDetail}
            onRetry={() => gameStore.retryBid()}
            onContinue={() => gameStore.dismissFeedback()}
            handEval={gameStore.biddingViewport?.handEvaluation ?? null}
            handSummary={gameStore.biddingViewport?.handSummary ?? null}
            biddingOptions={gameStore.biddingViewport?.biddingOptions ?? []}
          />
        </div>
      {:else}
        <BidPanel legalCalls={gameStore.legalCalls} onBid={(call) => gameStore.userBid(call)} {disabled} compact />
      {/if}
      <button
        class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[--radius-md] font-medium text-[--text-body] transition-colors bg-accent-primary hover:bg-accent-primary-hover text-text-on-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        onclick={onNewDeal}
        disabled={gameStore.isTransitioning}
        data-testid="settings-new-deal"
      >
        {#if gameStore.isTransitioning}
          <Spinner />
        {/if}
        New Deal
      </button>
    </div>
  </div>
{/if}
