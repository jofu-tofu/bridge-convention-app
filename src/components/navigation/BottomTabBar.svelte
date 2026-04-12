<script lang="ts">
  import { page } from "$app/state";
  import { getAppStoreOptional } from "../../stores/context";
  import { getNavItems, isItemActive, type NavItem } from "./nav-items";

  const appStore = getAppStoreOptional();

  const pathname = $derived(page.url.pathname);
  const items = getNavItems();

  function handleClear(item: NavItem) {
    if (!appStore) return;
    if (item.clearAction === "selection") appStore.clearSelection();
    else if (item.clearAction === "learning") appStore.clearLearningState();
    else if (item.clearAction === "workshop") appStore.clearWorkshopState();
  }
</script>

<nav
  class="h-14 bg-bg-base border-t border-border-subtle flex items-center justify-around shrink-0"
  style="padding-bottom: env(safe-area-inset-bottom)"
  aria-label="Main navigation"
>
  {#each items as item (item.href)}
    {@const active = isItemActive(item, pathname)}
    <a
      href={item.href}
      class="flex flex-col items-center gap-0.5 px-4 py-1.5 transition-colors no-underline
        {active ? 'text-accent-primary' : 'text-text-muted'}"
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      onclick={() => handleClear(item)}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted static icon markup -->
        {@html item.iconSvg}
      </svg>
      <span class="text-xs font-medium">{item.label}</span>
    </a>
  {/each}
</nav>
