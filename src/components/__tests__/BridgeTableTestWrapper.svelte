<script lang="ts">
  import BridgeTable from "../game/BridgeTable.svelte";
  import type { Hand } from "../../engine/types";
  import { Seat } from "../../engine/types";

  interface Props {
    hands: Record<Seat, Hand>;
    faceUpSeats: ReadonlySet<Seat>;
  }

  let { hands, faceUpSeats }: Props = $props();
</script>

<BridgeTable {hands} {faceUpSeats}>
  <div data-testid="center-content">Center</div>
</BridgeTable>
