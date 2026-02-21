<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    variant?: "primary" | "secondary" | "ghost";
    disabled?: boolean;
    onclick?: () => void;
    children: Snippet;
  }

  let { variant = "primary", disabled = false, onclick, children }: Props = $props();

  const variantClasses: Record<string, string> = {
    primary: "bg-accent-primary hover:bg-accent-primary-hover text-white",
    secondary: "bg-bg-elevated hover:bg-bg-hover text-text-primary border border-border-default",
    ghost: "bg-transparent hover:bg-bg-hover text-text-secondary",
  };

  const classes = $derived(variantClasses[variant] ?? variantClasses.primary);
</script>

<button
  class="px-4 py-2 rounded-[--radius-md] font-medium text-sm transition-colors {classes}"
  {disabled}
  onclick={disabled ? undefined : onclick}
>
  {@render children()}
</button>
