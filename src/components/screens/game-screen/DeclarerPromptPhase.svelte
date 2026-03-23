<script lang="ts">
  import type { DeclarerPromptViewport } from "../../../core/viewport";
  import { getLayoutConfig } from "../../../stores/context";
  import { getAppStore } from "../../../stores/context";
  import { PHASE_CONTAINER_CLASS, SIDE_PANEL_CLASS } from "../../../core/display/layout-props";
  import BridgeTable from "../../game/BridgeTable.svelte";
  import AuctionTable from "../../game/AuctionTable.svelte";
  import DeclarerPrompt from "../../game/DeclarerPrompt.svelte";
  import ScaledTableArea from "./ScaledTableArea.svelte";

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
  </aside>
</div>
