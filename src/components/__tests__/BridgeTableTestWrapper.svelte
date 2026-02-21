<script lang="ts">
  import BridgeTable from "../game/BridgeTable.svelte";
  import type { Hand } from "../../engine/types";
  import { Seat } from "../../engine/types";

  interface Props {
    hands: Record<Seat, Hand>;
    userSeat: Seat;
    dealer: Seat;
  }

  let { hands, userSeat, dealer }: Props = $props();
</script>

<BridgeTable {hands} {userSeat} {dealer}>
  <div data-testid="center-content">Center</div>
</BridgeTable>
