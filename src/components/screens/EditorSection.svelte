<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    defaultOpen?: boolean;
    children: Snippet;
  }

  const { title, defaultOpen = false, children }: Props = $props();

  let open = $state(defaultOpen);
</script>

<div class="border border-border-subtle rounded-[--radius-lg] overflow-hidden">
  <button
    type="button"
    class="w-full flex items-center justify-between px-5 py-3.5 bg-bg-card cursor-pointer
      hover:bg-bg-elevated transition-colors"
    onclick={() => { open = !open; }}
    aria-expanded={open}
  >
    <h3 class="text-sm font-semibold text-text-primary">{title}</h3>
    <svg
      class="w-4 h-4 text-text-muted transition-transform duration-200
        {open ? 'rotate-90' : 'rotate-0'}"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M6 3l5 5-5 5V3z" />
    </svg>
  </button>

  <div
    class="grid transition-[grid-template-rows] duration-200 ease-out
      {open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}"
  >
    <div class="overflow-hidden">
      <div class="px-5 py-4 space-y-4 bg-bg-card border-t border-border-subtle">
        {@render children()}
      </div>
    </div>
  </div>
</div>
