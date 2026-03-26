<script lang="ts">
  interface FlyoutItem {
    label: string;
    active: boolean;
    onclick: () => void;
  }

  interface Props {
    items: FlyoutItem[];
  }

  const { items }: Props = $props();

  function handleKeydown(e: KeyboardEvent, index: number) {
    if (e.key === "Escape") {
      e.preventDefault();
      // Parent handles close via pointerleave
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement | null;
      next?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (e.currentTarget as HTMLElement).previousElementSibling as HTMLElement | null;
      prev?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      items[index]?.onclick();
    }
  }
</script>

<div
  class="bg-bg-card border border-border-subtle border-l-0 rounded-r-[--radius-md] shadow-lg py-1 min-w-[160px]"
  role="menu"
>
  {#each items as item, i (item.label)}
    <button
      class="w-full px-4 py-2 text-sm text-left transition-colors cursor-pointer
        {item.active
          ? 'text-accent-primary font-medium'
          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}"
      role="menuitem"
      aria-current={item.active ? "page" : undefined}
      onclick={item.onclick}
      onkeydown={(e) => handleKeydown(e, i)}
    >
      {item.label}
    </button>
  {/each}
</div>
