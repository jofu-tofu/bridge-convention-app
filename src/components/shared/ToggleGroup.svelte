<script lang="ts">
  interface ToggleItem {
    id: string;
    label: string;
    title?: string;
    testId?: string;
  }

  interface Props {
    items: ToggleItem[];
    active: string;
    onSelect: (id: string) => void;
    ariaLabel: string;
    variant?: "outline" | "filled";
    compact?: boolean;
    disabled?: boolean;
    class?: string;
  }

  const {
    items,
    active,
    onSelect,
    ariaLabel,
    variant = "outline",
    compact = false,
    disabled = false,
    class: className = "",
  }: Props = $props();

  // Tailwind JIT purges dynamically built class strings — use complete literal strings.
  const ACTIVE_CLASSES = {
    outline: "bg-accent-primary/10 border-accent-primary text-accent-primary",
    filled: "bg-accent-primary text-text-on-accent shadow-sm",
  } as const;

  const INACTIVE_CLASSES = {
    outline: "bg-bg-base border-border-subtle text-text-muted hover:border-border-default",
    filled: "bg-bg-card text-text-secondary hover:text-text-primary hover:bg-bg-elevated border border-border-subtle",
  } as const;
</script>

<div
  class="flex {compact ? 'gap-1' : 'gap-2'} {className}"
  role="group"
  aria-label={ariaLabel}
>
  {#each items as item (item.id)}
    {@const isActive = active === item.id}
    <button
      class="flex-1 {compact ? 'px-2 py-1 rounded-[--radius-sm] text-[--text-label]' : 'px-3 py-2.5 rounded-[--radius-md] text-sm'} border font-medium transition-colors
        {isActive ? ACTIVE_CLASSES[variant] : INACTIVE_CLASSES[variant]}
        {disabled ? 'cursor-not-allowed' : 'cursor-pointer'}"
      onclick={() => onSelect(item.id)}
      {disabled}
      aria-pressed={isActive}
      title={item.title}
      data-testid={item.testId}
    >
      {item.label}
    </button>
  {/each}
</div>
