<script lang="ts">
  import type { PlayLogEntry } from "../../../stores/play.svelte";
  import { SUIT_SYMBOLS } from "../../../core/display/format";

  interface Props {
    playLog: readonly PlayLogEntry[];
  }

  let { playLog }: Props = $props();
</script>

<details>
  <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">Play Log</summary>
  <div class="pl-2 py-1">
    {#if playLog.length === 0}
      <div class="text-text-muted italic">No plays yet</div>
    {:else}
      {#each playLog as entry, i (entry.seat + '-' + entry.card.suit + entry.card.rank)}
        {#if i === 0 || entry.trickIndex !== playLog[i - 1]?.trickIndex}
          <div class="text-text-primary font-semibold mt-1">Trick {entry.trickIndex + 1}</div>
        {/if}
        <div class="pl-2">
          <span class="text-text-primary">{entry.seat}:</span>
          {SUIT_SYMBOLS[entry.card.suit]}{entry.card.rank}
          <span class="text-text-muted">({entry.reason})</span>
        </div>
      {/each}
    {/if}
  </div>
</details>
