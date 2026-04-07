<script lang="ts">
  import NumberStepper from "./NumberStepper.svelte";
  import type { Snippet } from "svelte";

  interface Props {
    minValue: number;
    maxValue: number;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
    onMinChange: (value: number) => void;
    onMaxChange: (value: number) => void;
    testId?: string;
    error?: Snippet;
  }

  const {
    minValue,
    maxValue,
    min = 0,
    max = 40,
    step = 1,
    suffix,
    onMinChange,
    onMaxChange,
    testId,
    error,
  }: Props = $props();
</script>

<div>
  <div class="inline-flex items-center gap-1.5">
    <NumberStepper
      value={minValue}
      {min}
      {max}
      {step}
      onchange={onMinChange}
      testId={testId ? `${testId}-min` : undefined}
    />
    <span class="text-xs text-text-muted">to</span>
    <NumberStepper
      value={maxValue}
      {min}
      {max}
      {step}
      onchange={onMaxChange}
      testId={testId ? `${testId}-max` : undefined}
    />
    {#if suffix}
      <span class="text-xs text-text-muted">{suffix}</span>
    {/if}
  </div>
  {#if error}
    {@render error()}
  {/if}
</div>
