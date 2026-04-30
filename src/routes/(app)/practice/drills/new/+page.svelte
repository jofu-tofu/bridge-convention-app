<script lang="ts">
  import AppScreen from "../../../../../components/shared/AppScreen.svelte";
  import DrillForm from "../../../../../components/screens/DrillForm.svelte";
</script>

<AppScreen
  title="New drill"
  subtitle="Save a single convention or a multi-convention round-robin drill."
  width="form"
>
  <DrillForm mode="create" />
</AppScreen>
