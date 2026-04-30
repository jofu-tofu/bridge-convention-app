<script lang="ts">
  import { tick } from "svelte";
  import { ConventionCategory, displayConventionName } from "../../service";
  import type { ConventionInfo } from "../../service";

  interface Props {
    /** All conventions available to pick from. */
    conventions: readonly ConventionInfo[];
    /** Convention IDs that should not be offered (e.g. already-selected). */
    excludeIds?: readonly string[];
    /** Predicate marking a convention as locked (entitlement-gated). */
    isLocked?: (moduleId: string) => boolean;
    /** Called with the picked convention id. Locked picks are forwarded; the parent decides
     *  whether to surface an entitlement error. */
    onPick: (moduleId: string) => void;
    /** Called when the popover closes without a pick (e.g. Esc / outside click).
     *  Lets the parent dismiss the picker for the "Add another" affordance. */
    onCancel?: () => void;
    /** Trigger label when no convention is selected yet (primary picker). */
    triggerLabel?: string;
    /** Test-id prefix for picker elements. */
    testIdPrefix?: string;
    /** Visual variant for the trigger. */
    variant?: "primary" | "subtle";
    /** Open the popover automatically on mount. Used by the "Add another" flow. */
    openOnMount?: boolean;
  }

  const {
    conventions,
    excludeIds = [],
    isLocked = () => false,
    onPick,
    onCancel,
    triggerLabel = "Choose a convention",
    testIdPrefix = "convention-picker",
    variant = "primary",
    openOnMount = false,
  }: Props = $props();

  let open = $state(false);
  let search = $state("");
  let highlightedId = $state<string | null>(null);
  let triggerEl = $state<HTMLButtonElement | null>(null);
  let searchEl = $state<HTMLInputElement | null>(null);
  let popoverEl = $state<HTMLDivElement | null>(null);

  const TRIGGER_CLASSES: Record<NonNullable<Props["variant"]>, string> = {
    primary:
      "inline-flex items-center justify-between gap-2 w-full rounded-[--radius-md] border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary hover:border-border-default cursor-pointer focus:outline-none focus:border-accent-primary",
    subtle:
      "inline-flex items-center gap-1.5 rounded-[--radius-md] px-2 py-1 text-xs font-medium text-accent-primary hover:text-accent-primary-hover cursor-pointer focus:outline-none focus:underline",
  };

  /** Excluded id set, recomputed reactively. */
  const excludedSet = $derived(new Set(excludeIds));

  /** Conventions that are still pickable (not already chosen). */
  const visibleConventions = $derived(
    conventions.filter((c) => !excludedSet.has(c.id)),
  );

  /** Apply text filter to visible conventions. */
  const filteredConventions = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visibleConventions;
    return visibleConventions.filter((c) => {
      const nameMatch = displayConventionName(c.name).toLowerCase().includes(q);
      const descMatch = (c.description ?? "").toLowerCase().includes(q);
      return nameMatch || descMatch;
    });
  });

  /** Group filtered conventions by ConventionCategory in declaration order. */
  const grouped = $derived.by(() => {
    const groups: { category: string; items: ConventionInfo[] }[] = [];
    for (const category of Object.values(ConventionCategory)) {
      const items = filteredConventions.filter((c) => c.category === category);
      if (items.length > 0) groups.push({ category, items });
    }
    // Anything without a known category falls into "Other" so it doesn't disappear.
    const known = new Set<string>(Object.values(ConventionCategory));
    const other = filteredConventions.filter((c) => !c.category || !known.has(c.category));
    if (other.length > 0) groups.push({ category: "Other", items: other });
    return groups;
  });

  /** Flat ordered list of currently visible items — used for arrow key navigation. */
  const flatVisible = $derived(grouped.flatMap((g) => g.items));

  /** Ensure the highlighted id stays valid as the filter changes. */
  $effect(() => {
    if (!open) return;
    if (flatVisible.length === 0) {
      highlightedId = null;
      return;
    }
    if (!highlightedId || !flatVisible.some((c) => c.id === highlightedId)) {
      highlightedId = flatVisible[0]!.id;
    }
  });

  $effect(() => {
    if (openOnMount) {
      void openPopover();
    }
  });

  async function openPopover(): Promise<void> {
    if (open) return;
    open = true;
    search = "";
    highlightedId = null;
    await tick();
    searchEl?.focus();
  }

  function closePopover(opts: { restoreFocus?: boolean; cancelled?: boolean } = {}): void {
    if (!open) return;
    open = false;
    if (opts.restoreFocus) {
      triggerEl?.focus();
    }
    if (opts.cancelled) {
      onCancel?.();
    }
  }

  function pickConvention(moduleId: string): void {
    onPick(moduleId);
    closePopover({ restoreFocus: true });
  }

  function moveHighlight(delta: number): void {
    if (flatVisible.length === 0) return;
    const idx = highlightedId
      ? flatVisible.findIndex((c) => c.id === highlightedId)
      : -1;
    const nextIdx = idx === -1
      ? (delta > 0 ? 0 : flatVisible.length - 1)
      : (idx + delta + flatVisible.length) % flatVisible.length;
    highlightedId = flatVisible[nextIdx]!.id;
    // Keep the highlighted option in view inside the scrollable list.
    queueMicrotask(() => {
      const el = popoverEl?.querySelector<HTMLElement>(
        `[data-option-id="${flatVisible[nextIdx]!.id}"]`,
      );
      el?.scrollIntoView({ block: "nearest" });
    });
  }

  function handleSearchKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        closePopover({ restoreFocus: true, cancelled: true });
        return;
      case "ArrowDown":
        event.preventDefault();
        moveHighlight(1);
        return;
      case "ArrowUp":
        event.preventDefault();
        moveHighlight(-1);
        return;
      case "Enter":
        event.preventDefault();
        if (highlightedId) pickConvention(highlightedId);
        return;
      default:
        return;
    }
  }

  function handlePopoverPointerDown(event: PointerEvent): void {
    // Outside-click handler: pointerdown on the document body, but inside-popover
    // pointerdowns are stopped via stopPropagation on the popover root.
    event.stopPropagation();
  }

  $effect(() => {
    if (!open) return;
    function onDocPointerDown(): void {
      closePopover({ cancelled: true });
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  });
</script>

<div class="relative">
  <button
    type="button"
    bind:this={triggerEl}
    class={TRIGGER_CLASSES[variant]}
    onclick={() => void openPopover()}
    aria-haspopup="listbox"
    aria-expanded={open}
    data-testid="{testIdPrefix}-trigger"
  >
    <span>{triggerLabel}</span>
    {#if variant === "primary"}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      ><path d="m6 9 6 6 6-6"/></svg>
    {/if}
  </button>

  {#if open}
    <div
      bind:this={popoverEl}
      class="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-hidden rounded-[--radius-md] border border-border-default bg-bg-card shadow-lg"
      role="dialog"
      aria-label="Pick a convention"
      onpointerdown={handlePopoverPointerDown}
    >
      <div class="border-b border-border-subtle p-2">
        <input
          bind:this={searchEl}
          bind:value={search}
          type="text"
          placeholder="Search conventions..."
          class="w-full rounded-[--radius-md] border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary"
          aria-label="Search conventions"
          onkeydown={handleSearchKeydown}
          data-testid="{testIdPrefix}-search"
        />
      </div>

      <div class="max-h-64 overflow-y-auto p-1" role="listbox">
        {#if grouped.length === 0}
          <p class="px-3 py-4 text-center text-xs text-text-muted">No conventions match.</p>
        {:else}
          {#each grouped as group (group.category)}
            <div class="mb-1 last:mb-0">
              <div class="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted/70">
                {group.category}
              </div>
              <ul class="space-y-0.5">
                {#each group.items as convention (convention.id)}
                  {@const locked = isLocked(convention.id)}
                  {@const highlighted = highlightedId === convention.id}
                  <li>
                    <button
                      type="button"
                      role="option"
                      aria-selected={highlighted}
                      data-option-id={convention.id}
                      data-testid="{testIdPrefix}-option-{convention.id}"
                      class="block w-full rounded-[--radius-sm] px-2 py-1.5 text-left transition-colors cursor-pointer
                        {highlighted ? 'bg-accent-primary/10 text-accent-primary' : 'text-text-primary hover:bg-bg-base'}
                        {locked ? 'opacity-60' : ''}"
                      onclick={() => pickConvention(convention.id)}
                      onmouseenter={() => { highlightedId = convention.id; }}
                    >
                      <span class="block text-sm font-medium">
                        {displayConventionName(convention.name)}
                        {#if locked}
                          <span class="ml-1 text-[10px] uppercase tracking-wide text-text-muted">Subscribe to unlock</span>
                        {/if}
                      </span>
                      {#if convention.description}
                        <span class="mt-0.5 block text-xs text-text-muted">{convention.description}</span>
                      {/if}
                    </button>
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
