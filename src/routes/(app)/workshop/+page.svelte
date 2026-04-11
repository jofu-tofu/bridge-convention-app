<script lang="ts">
  import { goto } from "$app/navigation";
  import { FEATURES } from "../../../stores/feature-flags";
  import WorkshopScreen from "../../../components/screens/WorkshopScreen.svelte";

  if (!FEATURES.workshop) {
    void goto("/");
  }
</script>

{#if FEATURES.workshop}
  <WorkshopScreen />
{/if}
