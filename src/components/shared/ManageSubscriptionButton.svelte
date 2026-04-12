<script lang="ts">
  import Button from "./Button.svelte";
  import { getDataPort } from "../../stores/context";

  const dataPort = getDataPort();

  let errorMessage = $state<string | null>(null);
  let isOpeningPortal = $state(false);

  async function handleClick() {
    errorMessage = null;
    isOpeningPortal = true;

    try {
      const { url } = await dataPort.openBillingPortal();
      if (!url) {
        // eslint-disable-next-line no-console -- explicit dev-mode no-op for local billing-disabled flows
        console.warn("Billing disabled in dev");
        return;
      }
      window.location.href = url;
    } catch {
      errorMessage = "Unable to open billing portal. Please try again.";
    } finally {
      isOpeningPortal = false;
    }
  }
</script>

<div class="space-y-2">
  <Button variant="secondary" disabled={isOpeningPortal} onclick={() => void handleClick()}>
    {isOpeningPortal ? "Opening…" : "Manage subscription"}
  </Button>

  {#if errorMessage}
    <p class="text-xs text-red-400" role="alert">{errorMessage}</p>
  {/if}
</div>
