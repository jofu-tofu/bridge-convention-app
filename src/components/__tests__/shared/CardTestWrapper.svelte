<script lang="ts">
  import Card from "../../shared/Card.svelte";
  import type { Card as CardType } from "../../../service";
  import { setAppStore } from "../../../stores/context";
  import type { createAppStore } from "../../../stores/app.svelte";

  interface Props {
    appStore: ReturnType<typeof createAppStore>;
    card: CardType;
  }

  const { appStore, card }: Props = $props();

  setAppStore(appStore);
</script>

<Card {card} />
