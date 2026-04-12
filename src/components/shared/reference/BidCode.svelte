<script lang="ts">
  import { formatCall } from "../../../service";
  import type { Call } from "../../../service";
  import { BID_SUIT_COLOR_CLASS } from "../tokens";
  import type { ReferenceBid, ReferenceSeat } from "./types";

  interface Props {
    value: ReferenceBid;
    seat?: ReferenceSeat | null;
    className?: string;
  }

  let { value, seat = null, className = "" }: Props = $props();

  function isCall(candidate: ReferenceBid): candidate is Call {
    return typeof candidate === "object" && candidate !== null && "type" in candidate;
  }

  function inferColorClass(display: string): string {
    if (display.includes("\u2660")) return "text-suit-spades";
    if (display.includes("\u2665")) return "text-suit-hearts";
    if (display.includes("\u2666")) return "text-suit-diamonds";
    if (display.includes("\u2663")) return "text-suit-clubs";
    return "text-text-primary";
  }

  const display = $derived(isCall(value) ? formatCall(value) : value);
  const bidColorClass = $derived.by(() => {
    if (isCall(value) && value.type === "bid") {
      return BID_SUIT_COLOR_CLASS[value.strain];
    }
    return inferColorClass(display);
  });
  const seatLabel = $derived(seat ? String(seat) : null);
</script>

<span class={`inline-flex items-baseline gap-2 ${className}`.trim()}>
  {#if seatLabel}
    <span
      class="text-[--text-annotation] font-semibold tracking-[0.16em] text-text-muted uppercase"
      style="font-variant-caps: all-small-caps;"
    >
      {seatLabel}
    </span>
  {/if}
  <span class={`font-mono font-semibold tabular-nums ${bidColorClass}`.trim()}>{display}</span>
</span>
