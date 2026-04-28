<script lang="ts">
  import type { AnnotationType } from "./BidBadge";
  import { isOpen, requestOpen, requestClose } from "./bid-badge-state.svelte";

  interface Props {
    id: string;
    type: AnnotationType;
    label: string;
    publicConditions?: readonly string[];
  }

  const { id, type, label, publicConditions = [] }: Props = $props();

  const popoverId = $derived(`${id}-popover`);
  const open = $derived(isOpen(id));

  function toggle(event: MouseEvent) {
    event.stopPropagation();
    if (isOpen(id)) {
      requestClose(id);
    } else {
      requestOpen(id);
    }
  }

  $effect(() => {
    return () => requestClose(id);
  });

  const BADGE_CLASS: Record<AnnotationType, string> = {
    alert: "bg-annotation-alert/20 text-annotation-alert",
    announce: "bg-annotation-announce/20 text-annotation-announce",
    educational: "bg-text-muted/20 text-text-muted",
  };

  const LABEL_CLASS: Record<AnnotationType, string> = {
    alert: "text-annotation-alert",
    announce: "text-annotation-announce",
    educational: "text-text-muted",
  };

  const TYPE_LABEL: Record<AnnotationType, string> = {
    alert: "Alert",
    announce: "Announce",
    educational: "Educational",
  };
</script>

<span
  class="bid-badge relative inline-flex"
  data-bid-badge
  data-annotation-type={type}
  data-open={open ? "true" : "false"}
>
  <button
    type="button"
    onclick={toggle}
    aria-describedby={popoverId}
    aria-expanded={open}
    aria-label={`${TYPE_LABEL[type]}: ${label}`}
    class="badge-glyph inline-flex items-center justify-center w-3.5 h-3.5 rounded-full leading-none {BADGE_CLASS[type]} focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary cursor-pointer"
  >
    {#if type === "alert"}
      <!-- Bell — bridge "alert" / Lucide bell -->
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    {:else if type === "announce"}
      <!-- Megaphone — "spoken aloud" / Lucide megaphone -->
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m3 11 18-5v12L3 14v-3z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </svg>
    {:else}
      <!-- Info — Lucide info -->
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    {/if}
  </button>
  <div
    id={popoverId}
    role="tooltip"
    class="badge-popover absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-[var(--z-tooltip)] bg-bg-card border border-border-default rounded-[--radius-md] shadow-lg p-2 text-left whitespace-normal w-48 text-[--text-annotation] font-sans"
  >
    <div class="font-semibold mb-1 {LABEL_CLASS[type]}">{label}</div>
    {#each publicConditions as condition (condition)}
      <div class="text-text-secondary leading-snug">{condition}</div>
    {/each}
  </div>
</span>

<style>
  .badge-popover {
    opacity: 0;
    pointer-events: none;
    transition: opacity 150ms;
  }
  .bid-badge:hover .badge-popover,
  .bid-badge:focus-within .badge-popover,
  .bid-badge[data-open="true"] .badge-popover {
    opacity: 1;
    pointer-events: auto;
  }
</style>
