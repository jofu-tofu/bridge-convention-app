<script lang="ts">
  import type { PlayLogEntry } from "../../../stores/game.svelte";
  import { SUIT_SYMBOLS } from "../../../service";
  import DebugSection from "./DebugSection.svelte";

  interface Props {
    playLog: readonly PlayLogEntry[];
  }

  let { playLog }: Props = $props();
</script>

<DebugSection title="Play Log" count={playLog.length || null}>
  {#if playLog.length === 0}
    <div class="text-text-muted italic text-[10px]">No plays yet</div>
  {:else}
    {#each playLog as entry, i (entry.seat + '-' + entry.card.suit + entry.card.rank)}
      {#if i === 0 || entry.trickIndex !== playLog[i - 1]?.trickIndex}
        <div class="text-[10px] text-text-primary font-semibold {i > 0 ? 'mt-0.5' : ''}">Trick {entry.trickIndex + 1}</div>
      {/if}
      <div class="pl-2 text-[10px] leading-tight">
        <span class="text-text-primary">{entry.seat}:</span>
        {SUIT_SYMBOLS[entry.card.suit]}{entry.card.rank}
        <span class="text-text-muted">({entry.reason})</span>
      </div>
    {/each}
  {/if}
</DebugSection>
