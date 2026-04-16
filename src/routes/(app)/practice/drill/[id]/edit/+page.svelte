<script lang="ts">
  import { page } from "$app/state";
  import CustomDrillForm from "../../../../../../components/screens/CustomDrillForm.svelte";
  import AppLink from "../../../../../../components/shared/AppLink.svelte";
  import { getCustomDrillsStore } from "../../../../../../stores/context";

  const drillsStore = getCustomDrillsStore();
  const drill = $derived(drillsStore.getDrill(page.params.id ?? ""));
</script>

{#if drill}
  <CustomDrillForm mode="edit" {drill} />
{:else}
  <main class="max-w-2xl mx-auto p-4">
    <p class="text-text-muted mb-2">Drill not found.</p>
    <AppLink variant="back" href="/practice/drill">Back to my drills</AppLink>
  </main>
{/if}
