<script lang="ts">
  import type { Contract } from "../../service";
  import { Seat } from "../../service";
  import { formatContractWithDeclarer } from "../../service";

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

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') onSkip(); }} />

<div
  class="bg-bg-card/95 rounded-[--radius-lg] p-3 border border-border-subtle shadow-lg text-center max-w-[240px]"
  role="dialog"
  aria-label={ariaLabel}
  aria-modal="true"
  aria-describedby="declarer-prompt-description"
>
  <p class="text-[--text-value] font-mono text-text-primary mb-1">
    {formatContractWithDeclarer(contract)}
  </p>
  <p id="declarer-prompt-description" class="text-text-secondary text-[--text-label] mb-2">
    {promptText}
  </p>
  <div class="flex gap-2 justify-center">
    <button
      type="button"
      class="px-3 py-1.5 rounded-[--radius-md] text-[--text-label] font-medium bg-accent-primary hover:bg-accent-primary-hover text-text-on-accent transition-colors"
      onclick={onAccept}
    >
      {acceptLabel}
    </button>
    <button
      type="button"
      class="px-3 py-1.5 rounded-[--radius-md] text-[--text-label] font-medium bg-bg-elevated hover:bg-bg-hover text-text-primary border border-border-default transition-colors"
      onclick={onSkip}
    >
      Skip
    </button>
  </div>
</div>
