<script lang="ts">
  import QuickPracticeSettingsPanel from "../../screens/QuickPracticeSettingsPanel.svelte";
  import { setAppStore, setCustomSystemsStore } from "../../../stores/context";
  import type { createAppStore } from "../../../stores/app.svelte";
  import type { createCustomSystemsStore } from "../../../stores/custom-systems.svelte";

  interface Props {
    appStore: ReturnType<typeof createAppStore>;
    customSystemsStore: ReturnType<typeof createCustomSystemsStore>;
    showHeader?: boolean;
  }

  const { appStore, customSystemsStore, showHeader = true }: Props = $props();

  setAppStore(appStore);
  setCustomSystemsStore(customSystemsStore);
</script>

<QuickPracticeSettingsPanel {showHeader} />
