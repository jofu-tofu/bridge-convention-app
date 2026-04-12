<script lang="ts">
  import { page } from "$app/state";
  import CustomDrillForm from "../../../../../../components/screens/CustomDrillForm.svelte";
  import { getCustomDrillsStore } from "../../../../../../stores/context";

  const drillsStore = getCustomDrillsStore();
  const drill = $derived(drillsStore.getDrill(page.params.id ?? ""));
</script>

{#if drill}
  <CustomDrillForm mode="edit" {drill} />
{:else}
  <main class="max-w-2xl mx-auto p-4">
    <p class="text-text-muted">Drill not found.</p>
    <a href="/practice/drill" class="text-accent-primary">Back to my drills</a>
  </main>
{/if}
