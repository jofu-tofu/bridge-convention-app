<script lang="ts">
  import type { Contract } from "../../engine/types";
  import { Seat } from "../../engine/types";
  import { STRAIN_SYMBOLS } from "../../display/format";

  type PromptMode = "declarer-swap" | "defender" | "south-declarer";

  interface Props {
    contract: Contract;
    userSeat: Seat;
    mode: PromptMode;
    onAccept: () => void;
    onSkip: () => void;
  }

  let { contract, userSeat, mode, onAccept, onSkip }: Props = $props();

  const ariaLabel = $derived(
    mode === "defender"
      ? "Defender prompt"
      : mode === "south-declarer"
        ? "Declarer prompt"
        : "Declarer swap prompt",
  );

  const promptText = $derived(
    mode === "defender"
      ? `Defend as ${userSeat}?`
      : mode === "south-declarer"
        ? "Play as declarer?"
        : `Play as ${contract.declarer} (declarer)?`,
  );

  const acceptLabel = $derived(
    mode === "defender" ? "Defend" : "Play",
  );
</script>

<div
  class="bg-bg-card/95 rounded-[--radius-lg] p-3 border border-border-subtle shadow-lg text-center max-w-[240px]"
  role="dialog"
  aria-label={ariaLabel}
>
  <p class="text-base font-mono text-text-primary mb-1">
    {contract.level}{STRAIN_SYMBOLS[contract.strain]}{contract.doubled
      ? " X"
      : ""}{contract.redoubled ? " XX" : ""}
    by {contract.declarer}
  </p>
  <p class="text-text-secondary text-xs mb-2">
    {promptText}
  </p>
  <div class="flex gap-2 justify-center">
    <button
      type="button"
      class="px-3 py-1.5 rounded-[--radius-md] text-xs font-medium bg-accent-primary hover:bg-accent-primary-hover text-text-on-accent transition-colors"
      onclick={onAccept}
    >
      {acceptLabel}
    </button>
    <button
      type="button"
      class="px-3 py-1.5 rounded-[--radius-md] text-xs font-medium bg-bg-elevated hover:bg-bg-hover text-text-primary border border-border-default transition-colors"
      onclick={onSkip}
    >
      Skip
    </button>
  </div>
</div>
