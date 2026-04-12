<script lang="ts">
  import "../app.css";
  import { browser } from "$app/environment";
  import { createAuthStore } from "../stores/auth.svelte";
  import { DataPortClient, DevDataPort, SubscriptionTier, type DataPort } from "../service";
  import { getDevAuthOverride } from "../stores/dev-params";
  import { setAuthStore, setDataPort } from "../stores/context";

  const { children } = $props();

  if (browser) {
    const e2eRealApi = new URLSearchParams(window.location.search).get("e2e") === "1";
    const devAuthTier = e2eRealApi
      ? null
      : (getDevAuthOverride() ?? (import.meta.env.DEV ? SubscriptionTier.Paid : null));
    const dataPort: DataPort = devAuthTier ? new DevDataPort(devAuthTier) : new DataPortClient();
    setDataPort(dataPort);
    setAuthStore(createAuthStore(dataPort));
  }
</script>

{@render children()}
