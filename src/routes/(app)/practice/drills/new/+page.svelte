<script lang="ts">
  import { page } from "$app/state";
  import AppScreen from "../../../../../components/shared/AppScreen.svelte";
  import DrillForm from "../../../../../components/screens/DrillForm.svelte";

  const prefillConvention = $derived(page.url.searchParams.get("convention") ?? undefined);
</script>

<AppScreen
  title="New drill"
  subtitle="Save a single convention or a multi-convention round-robin drill."
  width="form"
>
  <DrillForm mode="create" {prefillConvention} />
</AppScreen>
