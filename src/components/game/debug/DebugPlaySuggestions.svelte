<script lang="ts">
  import type { PlaySuggestions } from "../../../service/debug-types";
  import { SUIT_SYMBOLS } from "../../../service";
  import DebugSection from "./DebugSection.svelte";

  interface Props {
    suggestions: PlaySuggestions;
  }

  let { suggestions }: Props = $props();

  const PROFILE_COLORS: Record<string, string> = {
    beginner: "text-yellow-300",
    "club-player": "text-blue-300",
    expert: "text-purple-300",
    "world-class": "text-green-300",
  };
</script>

<DebugSection title="Play Suggestions" count={suggestions.length || null}>
  {#if suggestions.length === 0}
    <div class="text-text-muted italic text-[10px]">No suggestions (not your turn)</div>
  {:else}
    {#each suggestions as s (s.profileId)}
      {@const isFallback = s.reason.startsWith("expert-fallback")}
      <div class="flex items-baseline gap-2 text-[10px] leading-snug py-0.5 {isFallback && s.profileId === 'world-class' ? 'opacity-60' : ''}">
        <span class="font-semibold min-w-[80px] {PROFILE_COLORS[s.profileId] ?? 'text-text-secondary'}">
          {s.profileName}{#if isFallback && s.profileId === "world-class"}<span class="text-text-muted font-normal"> (no DDS)</span>{/if}
        </span>
        <span class="text-text-primary font-bold">{SUIT_SYMBOLS[s.card.suit]}{s.card.rank}</span>
        <span class="text-text-muted truncate">({s.reason})</span>
      </div>
    {/each}
  {/if}
</DebugSection>
