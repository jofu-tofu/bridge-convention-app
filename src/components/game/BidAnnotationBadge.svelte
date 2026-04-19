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

  const GLYPH: Record<AnnotationType, string> = {
    alert: "A",
    announce: "A",
    educational: "i",
  };

  const BADGE_CLASS: Record<AnnotationType, string> = {
    alert: "bg-annotation-alert/20 text-annotation-alert",
    announce: "bg-annotation-announce/20 text-annotation-announce underline",
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
    class="badge-glyph inline-flex items-center justify-center w-3.5 h-3.5 rounded-full font-sans font-bold leading-none text-[--text-annotation] {BADGE_CLASS[type]} focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary cursor-pointer"
  >
    {GLYPH[type]}
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
