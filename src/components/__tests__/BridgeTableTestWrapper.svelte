<script lang="ts">
  import BridgeTable from "../game/BridgeTable.svelte";
  import type { Hand } from "../../service";
  import { Seat } from "../../service";

  interface Props {
    hands: Record<Seat, Hand>;
    faceUpSeats: ReadonlySet<Seat>;
  }

  let { hands, faceUpSeats }: Props = $props();
</script>

<BridgeTable {hands} {faceUpSeats}>
  <div data-testid="center-content">Center</div>
</BridgeTable>
