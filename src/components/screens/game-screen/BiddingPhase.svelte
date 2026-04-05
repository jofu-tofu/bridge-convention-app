<script lang="ts">
  import type { BiddingViewport } from "../../../service";
  import { getGameStore, getLayoutConfig } from "../../../stores/context";
  import { getAppStore } from "../../../stores/context";
  import { PHASE_CONTAINER_CLASS, PANEL_FONT_STYLE, SIDE_PANEL_CLASS } from "../../shared/layout-props";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import BiddingSidePanel from "./BiddingSidePanel.svelte";
  import SettingsDialog from "./SettingsDialog.svelte";
  import { buildContextSummary } from "./context-banner";

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

  let settingsDialogRef = $state<ReturnType<typeof SettingsDialog>>();

  const contextSummary = $derived(buildContextSummary(viewport));
</script>

{#if contextSummary}
  <div class="px-4 py-2 bg-bg-card/50 border-b border-border-subtle text-text-secondary text-[--text-detail] shrink-0">
    {contextSummary}
  </div>
{/if}
<div class={PHASE_CONTAINER_CLASS}>
  <ScaledTableArea scale={layout.tableScale} origin={layout.tableOrigin} tableWidth={layout.tableBaseW} tableHeight={layout.tableBaseH}>
    <BridgeTable visibleHands={viewport.visibleHands} handEvaluation={viewport.handEvaluation} vulnerability={viewport.vulnerability}>
      <div
        class="relative bg-bg-card rounded-[--radius-lg] p-3 border border-border-subtle shadow-md"
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
      onOpenSettings={() => settingsDialogRef?.open()}
    />
  </aside>
</div>

<SettingsDialog bind:this={settingsDialogRef} />
