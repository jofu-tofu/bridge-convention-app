<script lang="ts">
  import type { DeclarerPromptViewport } from "../../../service";
  import { getLayoutConfig } from "../../../stores/context";
  import { getAppStore } from "../../../stores/context";
  import { PHASE_CONTAINER_CLASS, SIDE_PANEL_CLASS } from "../../shared/layout-props";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";
  import DeclarerPrompt from "../../game/DeclarerPrompt.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";
  import SettingsDialog from "./SettingsDialog.svelte";

  interface Props {
    viewport: DeclarerPromptViewport;
    onAccept: () => void;
    onSkip: () => void;
  }

  const {
    viewport,
    onAccept,
    onSkip,
  }: Props = $props();

  const layout = getLayoutConfig();
  const appStore = getAppStore();

  let settingsDialogRef = $state<ReturnType<typeof SettingsDialog>>();
</script>

<div class={PHASE_CONTAINER_CLASS}>
  <ScaledTableArea scale={layout.tableScale} origin={layout.tableOrigin} tableWidth={layout.tableBaseW} tableHeight={layout.tableBaseH}>
    <BridgeTable
      visibleHands={viewport.visibleHands}
      vulnerability={viewport.vulnerability}
    >
      <DeclarerPrompt
        contract={viewport.contract}
        userSeat={viewport.userSeat}
        mode={viewport.promptMode}
        {onAccept}
        {onSkip}
      />
    </BridgeTable>
  </ScaledTableArea>

  <aside class="{SIDE_PANEL_CLASS}" style="font-size: var(--panel-font, 1rem);" aria-label="Auction summary">
    <div
      class="bg-bg-card rounded-[--radius-lg] p-3 border border-border-subtle shadow-md"
    >
      <AuctionTable
        entries={viewport.auctionEntries}
        dealer={viewport.dealer}
        showEducationalAnnotations={appStore.displaySettings.showEducationalAnnotations}
        compact
      />
    </div>
    <button
      class="w-full flex items-center justify-center gap-2 mt-2 px-3 py-2 rounded-[--radius-md] font-medium text-[--text-body] transition-colors border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default cursor-pointer"
      onclick={() => settingsDialogRef?.open()}
      data-testid="declarer-open-settings"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      Settings
    </button>
  </aside>
</div>

<SettingsDialog readonly bind:this={settingsDialogRef} />
