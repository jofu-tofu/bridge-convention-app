<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import AppScreen from "../../../../../../components/shared/AppScreen.svelte";
  import DrillForm from "../../../../../../components/screens/DrillForm.svelte";
  import { getDrillsStore } from "../../../../../../stores/context";

  const drillsStore = getDrillsStore();
  const drill = $derived(drillsStore.getById(page.params.id ?? ""));

  $effect(() => {
    if (!drill) {
      void goto("/practice/drills", { replaceState: true });
    }
  });
</script>

{#if drill}
  <AppScreen title="Edit drill" subtitle="Update the saved setup or launch it immediately." width="form">
    <DrillForm mode="edit" {drill} />
  </AppScreen>
{/if}
