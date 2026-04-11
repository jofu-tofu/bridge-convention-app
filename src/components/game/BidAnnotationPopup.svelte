<script lang="ts">
  import type { AuctionEntryView, BidHistoryEntry } from "../../service";

  interface Props {
    entry: AuctionEntryView;
    historyEntry: BidHistoryEntry;
  }

  const { entry, historyEntry }: Props = $props();
</script>

<div
  class="bg-bg-card border border-border-subtle rounded-[--radius-lg] shadow-md px-4 py-3 animate-popup"
  role="status"
  aria-live="polite"
>
  <div class="flex items-center gap-2 mb-1">
    <span class="text-[--text-label] font-bold text-text-primary">{entry.seat}:</span>
    <span class="text-[--text-label] font-bold text-text-primary">{entry.callDisplay}</span>
    {#if entry.alertLabel}
      <span class="text-[--text-annotation] px-1.5 py-0.5 rounded-full font-medium bg-accent-danger/20 text-accent-danger">
        {entry.annotationType === "announce" ? "Announce" : "Alert"}: {entry.alertLabel}
      </span>
    {/if}
  </div>
  {#if historyEntry.meaning}
    <p class="text-[--text-body] text-text-secondary leading-relaxed">{historyEntry.meaning}</p>
  {:else if entry.call.type === "pass"}
    <p class="text-[--text-body] text-text-muted italic">Pass</p>
  {:else}
    <p class="text-[--text-body] text-text-muted italic">Natural bid</p>
  {/if}
</div>

<style>
  .animate-popup {
    animation: popup-enter 0.2s ease-out;
  }
  @keyframes popup-enter {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
