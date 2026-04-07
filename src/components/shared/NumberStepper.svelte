<script lang="ts">
  import { clamp, createAutoRepeat } from "./NumberStepper";

  interface Props {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
    onchange: (value: number) => void;
    testId?: string;
  }

  const {
    value,
    min = 0,
    max = 40,
    step = 1,
    suffix,
    onchange,
    testId,
  }: Props = $props();

  const decRepeat = createAutoRepeat(() => {
    if (value > min) onchange(value - step);
  });
  const incRepeat = createAutoRepeat(() => {
    if (value < max) onchange(value + step);
  });

  function handleInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const parsed = parseInt(input.value, 10);
    if (!Number.isNaN(parsed)) {
      onchange(clamp(parsed, min, max));
    }
  }

  function handleBlur(e: FocusEvent) {
    const input = e.target as HTMLInputElement;
    const parsed = parseInt(input.value, 10);
    if (Number.isNaN(parsed) || input.value === "") {
      onchange(value);
    } else {
      const clamped = clamp(parsed, min, max);
      onchange(clamped);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (value < max) onchange(value + step);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (value > min) onchange(value - step);
    }
  }
</script>

<div class="inline-flex items-center gap-0.5" data-testid={testId}>
  <button
    type="button"
    class="w-7 h-7 flex items-center justify-center rounded-[--radius-sm] border border-border-subtle
      text-text-muted transition-colors select-none
      {value <= min ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-elevated hover:text-text-primary cursor-pointer'}"
    disabled={value <= min}
    onpointerdown={decRepeat.start}
    onpointerup={decRepeat.stop}
    onpointerleave={decRepeat.stop}
    aria-label="Decrease"
    tabindex={-1}
  >&minus;</button>

  <input
    type="number"
    class="w-10 h-7 text-center text-sm text-text-primary bg-bg-base border border-border-subtle
      rounded-[--radius-sm] appearance-none [&::-webkit-inner-spin-button]:appearance-none
      [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]
      focus:outline-none focus:border-accent-primary"
    {min}
    {max}
    {step}
    value={value}
    oninput={handleInput}
    onblur={handleBlur}
    onkeydown={handleKeydown}
  />

  <button
    type="button"
    class="w-7 h-7 flex items-center justify-center rounded-[--radius-sm] border border-border-subtle
      text-text-muted transition-colors select-none
      {value >= max ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-elevated hover:text-text-primary cursor-pointer'}"
    disabled={value >= max}
    onpointerdown={incRepeat.start}
    onpointerup={incRepeat.stop}
    onpointerleave={incRepeat.stop}
    aria-label="Increase"
    tabindex={-1}
  >+</button>

  {#if suffix}
    <span class="text-xs text-text-muted ml-1">{suffix}</span>
  {/if}
</div>
