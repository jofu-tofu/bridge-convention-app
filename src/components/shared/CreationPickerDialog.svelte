<script lang="ts">
  import type { PickerCategory } from "./creation-picker";
  import ItemCard from "./ItemCard.svelte";

  interface Props {
    title: string;
    categories: PickerCategory[];
    scratchLabel?: string;
    searchable?: boolean;
    searchPlaceholder?: string;
    onSelect: (id: string) => void;
    onScratch?: () => void;
    scratchDisabled?: boolean;
    wide?: boolean;
  }

  let {
    title,
    categories,
    scratchLabel,
    searchable = false,
    searchPlaceholder = "Search...",
    onSelect,
    onScratch,
    scratchDisabled = false,
    wide = false,
  }: Props = $props();

  let dialogRef = $state<HTMLDialogElement>();
  let searchQuery = $state("");

  export function open() {
    searchQuery = "";
    dialogRef?.showModal();
  }
  export function close() { dialogRef?.close(); }

  function handleSelect(id: string) {
    close();
    onSelect(id);
  }

  function handleScratch() {
    close();
    onScratch?.();
  }

  const filteredCategories = $derived.by(() => {
    if (!searchQuery) return categories;
    const q = searchQuery.toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => item.label.toLowerCase().includes(q)),
      }))
      .filter((cat) => cat.items.length > 0);
  });
</script>

<dialog
  bind:this={dialogRef}
  class="m-auto bg-bg-card border border-border-subtle rounded-[--radius-lg] shadow-xl p-0 w-[calc(100%-2rem)] {wide ? 'max-w-lg' : 'max-w-md'}"
  onclick={(e) => { if (e.target === e.currentTarget) close(); }}
  data-testid="creation-picker-dialog"
>
  <div class="flex flex-col">
    <!-- Header -->
    <header class="flex items-center justify-between p-4 pb-2 shrink-0">
      <h2 class="text-sm font-semibold text-text-primary">{title}</h2>
      <button
        class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
        onclick={close}
        aria-label="Close"
        data-testid="creation-picker-close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </header>

    <!-- Search -->
    {#if searchable}
      <div class="px-4 pb-2">
        <input
          type="text"
          placeholder={searchPlaceholder}
          bind:value={searchQuery}
          class="w-full px-3 py-1.5 text-sm bg-bg-base border border-border-subtle rounded-[--radius-md] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary"
          data-testid="creation-picker-search"
        />
      </div>
    {/if}

    <!-- Body -->
    <div class="overflow-y-auto max-h-[70vh] px-4 pb-4 space-y-4">
      <!-- Start from scratch -->
      {#if scratchLabel && (onScratch || scratchDisabled)}
        {#if scratchDisabled}
          <ItemCard
            interactive={false}
            testId="creation-picker-scratch"
            class="border-dashed opacity-50"
          >
            <div class="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-text-muted shrink-0" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              <span class="text-sm font-medium text-text-muted">{scratchLabel}</span>
              <span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-bg-surface text-text-muted">Coming soon</span>
            </div>
          </ItemCard>
        {:else}
          <ItemCard
            onclick={handleScratch}
            testId="creation-picker-scratch"
            class="border-dashed"
          >
            <div class="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-text-muted shrink-0" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              <span class="text-sm font-medium text-text-secondary">{scratchLabel}</span>
            </div>
          </ItemCard>
        {/if}
      {/if}

      <!-- Categories -->
      {#each filteredCategories as category (category.name)}
        <div>
          <p class="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">{category.name}</p>
          <div class="space-y-2">
            {#each category.items as item (item.id)}
              {#if item.locked}
                <ItemCard
                  interactive={false}
                  testId="creation-picker-item-{item.id}"
                  class="opacity-60"
                >
                  <p class="font-semibold text-text-muted text-sm">{item.label}</p>
                  {#if item.description}
                    <p class="text-xs text-text-muted mt-0.5">{item.description}</p>
                  {/if}
                  {#if item.detail}
                    <p class="text-xs text-text-muted mt-0.5">{item.detail}</p>
                  {/if}
                  <a
                    href="/billing/pricing"
                    class="mt-1 inline-block text-xs font-medium text-accent-primary underline hover:text-accent-primary-hover"
                    data-testid="creation-picker-unlock-{item.id}"
                  >
                    Subscribe to unlock
                  </a>
                </ItemCard>
              {:else}
                <ItemCard
                  onclick={() => handleSelect(item.id)}
                  testId="creation-picker-item-{item.id}"
                >
                  <p class="font-semibold text-text-primary text-sm">{item.label}</p>
                  {#if item.description}
                    <p class="text-xs text-text-secondary mt-0.5">{item.description}</p>
                  {/if}
                  {#if item.detail}
                    <p class="text-xs text-text-muted mt-0.5">{item.detail}</p>
                  {/if}
                </ItemCard>
              {/if}
            {/each}
          </div>
        </div>
      {/each}

      {#if filteredCategories.length === 0 && searchQuery}
        <p class="text-sm text-text-muted py-4 text-center">No results for "{searchQuery}"</p>
      {/if}
    </div>
  </div>
</dialog>

<style>
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }
</style>
