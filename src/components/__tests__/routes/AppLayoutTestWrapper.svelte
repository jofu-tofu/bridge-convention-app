<script lang="ts">
  import AppLayout from "../../../routes/(app)/+layout.svelte";
  import { setAuthStore, setDataPort } from "../../../stores/context";
  import { createAuthStore } from "../../../stores/auth.svelte";
  import type { DataPort } from "../../../service";

  interface Props {
    dataPort: DataPort;
  }

  const { dataPort }: Props = $props();

  setDataPort(dataPort);
  setAuthStore(createAuthStore(dataPort));
</script>

<AppLayout>
  <div data-testid="layout-children">child</div>
</AppLayout>
