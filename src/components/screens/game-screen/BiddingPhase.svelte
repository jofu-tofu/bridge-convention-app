<script lang="ts">
  import type { BiddingViewport } from "../../../service";
  import { getGameStore, getLayoutConfig } from "../../../stores/context";
  import { getAppStore } from "../../../stores/context";
  import { PHASE_CONTAINER_CLASS, SIDE_PANEL_CLASS } from "../../../core/display/layout-props";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import BiddingSidePanel from "./BiddingSidePanel.svelte";
  import BiddingSettingsPanel from "./BiddingSettingsPanel.svelte";

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

  let settingsDialog = $state<HTMLDialogElement>();

  function openSettings() {
    settingsDialog?.showModal();
  }

  function closeSettings() {
    settingsDialog?.close();
  }
</script>

<div class={PHASE_CONTAINER_CLASS}>
  <ScaledTableArea scale={layout.tableScale} origin={layout.tableOrigin} tableWidth={layout.tableBaseW} tableHeight={layout.tableBaseH}>
    <BridgeTable visibleHands={viewport.visibleHands} vulnerability={viewport.vulnerability}>
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
      onOpenSettings={openSettings}
    />
  </aside>
</div>

<!-- Settings dialog -->
<dialog
  bind:this={settingsDialog}
  class="bg-bg-card border border-border-subtle rounded-[--radius-lg] shadow-xl p-0 w-[calc(100%-2rem)] max-w-sm"
  style="font-size: var(--panel-font, 1rem);"
  onclick={(e) => { if (e.target === e.currentTarget) closeSettings(); }}
  data-testid="settings-dialog"
>
  <div class="flex flex-col max-h-[80vh]">
    <header class="flex items-center justify-between p-4 pb-2 shrink-0">
      <h2 class="text-[--text-heading] font-semibold text-text-primary">Settings</h2>
      <button
        class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
        onclick={closeSettings}
        aria-label="Close settings"
        data-testid="settings-dialog-close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </header>
    <div class="flex-1 overflow-y-auto px-4 pb-4">
      <BiddingSettingsPanel />
    </div>
    <div class="shrink-0 p-4 pt-2 border-t border-border-subtle">
      <button
        class="w-full px-3 py-2 rounded-[--radius-md] font-medium text-[--text-body] transition-colors bg-accent-primary hover:bg-accent-primary-hover text-text-on-accent cursor-pointer"
        onclick={closeSettings}
        data-testid="settings-done"
      >
        Done
      </button>
    </div>
  </div>
</dialog>

<style>
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }
</style>
