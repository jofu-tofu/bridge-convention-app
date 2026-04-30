<script lang="ts">
  import DrillForm from "../../screens/DrillForm.svelte";
  import { setAppStore, setCustomSystemsStore, setDrillsStore } from "../../../stores/context";
  import type { createAppStore } from "../../../stores/app.svelte";
  import type { createCustomSystemsStore } from "../../../stores/custom-systems.svelte";
  import type { createDrillsStore, Drill } from "../../../stores/drills.svelte";

  interface Props {
    appStore: ReturnType<typeof createAppStore>;
    customSystemsStore: ReturnType<typeof createCustomSystemsStore>;
    drillsStore: ReturnType<typeof createDrillsStore>;
    mode: "create" | "edit";
    drill?: Drill;
  }

  const { appStore, customSystemsStore, drillsStore, mode, drill }: Props = $props();

  setAppStore(appStore);
  setCustomSystemsStore(customSystemsStore);
  setDrillsStore(drillsStore);
</script>

<DrillForm {mode} {drill} />
