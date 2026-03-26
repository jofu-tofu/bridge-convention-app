<script lang="ts">
  import { getAppStore } from "../../stores/context";
  import { createLearnSubItems } from "./learn-sub-items";

  const appStore = getAppStore();

  const items = $derived(
    createLearnSubItems(appStore.screen, {
      toConventions: () => appStore.navigateToLearningHome(),
      toProfiles: () => appStore.navigateToProfiles(),
    }),
  );
</script>

<nav
  class="shrink-0 bg-bg-base border-b border-border-subtle px-4 py-2"
  aria-label="Learn section"
>
  <div class="flex rounded-[--radius-md] bg-bg-card p-0.5 gap-0.5">
    {#each items as item (item.label)}
      <button
        class="flex-1 py-1.5 text-sm font-medium rounded-[7px] transition-all duration-150 cursor-pointer
          {item.active
            ? 'bg-accent-primary text-text-on-accent shadow-sm'
            : 'text-text-muted hover:text-text-secondary'}"
        aria-current={item.active ? "page" : undefined}
        onclick={item.onclick}
      >
        {item.label}
      </button>
    {/each}
  </div>
</nav>
