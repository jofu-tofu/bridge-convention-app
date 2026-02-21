<script lang="ts">
  import BridgeTable from "../game/BridgeTable.svelte";
  import type { Hand } from "../../engine/types";
  import { Seat } from "../../engine/types";

  interface Props {
    hands: Record<Seat, Hand>;
    userSeat: Seat;
  }

  let { hands, userSeat }: Props = $props();
</script>

<BridgeTable {hands} {userSeat}>
  <div data-testid="center-content">Center</div>
</BridgeTable>
