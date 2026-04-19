<script lang="ts">
  import type { AnnotationType } from "./BidBadge";
  import { displayBidText } from "./BidBadge";
  import BidAnnotationBadge from "./BidAnnotationBadge.svelte";

  interface Props {
    id: string;
    text: string;
    isPlaceholder?: boolean;
    colorClass?: string;
    alertLabel?: string;
    annotationType?: AnnotationType;
    publicConditions?: readonly string[];
    compact?: boolean;
    minimal?: boolean;
  }

  const {
    id,
    text,
    isPlaceholder = false,
    colorClass = "",
    alertLabel,
    annotationType,
    publicConditions,
    compact = false,
    minimal = false,
  }: Props = $props();

  const display = $derived(displayBidText(text));
  const annotated = $derived(
    !isPlaceholder && alertLabel !== undefined && annotationType !== undefined,
  );

  const padding = $derived(minimal ? "px-1 py-0" : compact ? "px-1.5 py-0.5" : "px-2 py-0.5");
  const textColor = $derived(
    isPlaceholder ? "text-text-muted" : colorClass || "text-text-primary",
  );
</script>

<span class="relative inline-block">
  {#if isPlaceholder}
    <span class="inline-flex items-center justify-center {padding} {textColor}">
      {display}
    </span>
  {:else}
    <span
      class="inline-flex items-center justify-center min-w-[2.25rem] rounded-[--radius-sm] border border-border-subtle {padding} {textColor}"
      data-bid-box
    >
      {display}
    </span>
    {#if annotated && annotationType && alertLabel}
      <span class="absolute top-0 right-0 -translate-y-1/3 translate-x-1/3">
        <BidAnnotationBadge
          {id}
          type={annotationType}
          label={alertLabel}
          {publicConditions}
        />
      </span>
    {/if}
  {/if}
</span>
