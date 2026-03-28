<script lang="ts">
  import type { BiddingViewport } from "../../../service";
  import { getGameStore, getLayoutConfig } from "../../../stores/context";
  import { getAppStore } from "../../../stores/context";
  import { PHASE_CONTAINER_CLASS, SIDE_PANEL_CLASS } from "../../shared/layout-props";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import BiddingSidePanel from "./BiddingSidePanel.svelte";
  import SettingsDialog from "./SettingsDialog.svelte";

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
</script>

<div class={PHASE_CONTAINER_CLASS}>
  <ScaledTableArea scale={layout.tableScale} origin={layout.tableOrigin} tableWidth={layout.tableBaseW} tableHeight={layout.tableBaseH}>
    <BridgeTable visibleHands={viewport.visibleHands} handEvaluation={viewport.handEvaluation} vulnerability={viewport.vulnerability}>
      <div
        class="bg-bg-card rounded-[--radius-lg] p-3 border border-border-subtle shadow-md"
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

  <aside class="{SIDE_PANEL_CLASS}" style="font-size: var(--panel-font, 1rem);" aria-label="Bidding controls">
    <BiddingSidePanel
      {onNewDeal}
      lifecycleDisabled={gameStore.isTransitioning}
      onOpenSettings={() => settingsDialogRef?.open()}
    />
  </aside>
</div>

<SettingsDialog bind:this={settingsDialogRef} />
