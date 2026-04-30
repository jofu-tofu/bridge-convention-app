<script lang="ts">
  import SettingsScreen from "../../screens/SettingsScreen.svelte";
  import { setAppStore, setAuthStore } from "../../../stores/context";
  import type { createAppStore } from "../../../stores/app.svelte";
  import type { createAuthStore } from "../../../stores/auth.svelte";

  interface Props {
    appStore: ReturnType<typeof createAppStore>;
    authStore: ReturnType<typeof createAuthStore>;
  }

  const { appStore, authStore }: Props = $props();

  setAppStore(appStore);
  setAuthStore(authStore);
</script>

<SettingsScreen />
