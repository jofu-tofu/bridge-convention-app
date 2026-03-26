<script lang="ts">
  import { getAppStore } from "../../stores/context";
  import { createLearnSubItems } from "./learn-sub-items";
  import NavFlyout from "./NavFlyout.svelte";

  const appStore = getAppStore();

  const RAIL_WIDTH = 80;

  const isHomeActive = $derived(appStore.screen === "conventions" || appStore.screen === "game");

  const isLearnActive = $derived(
    appStore.screen === "learning" ||
    appStore.screen === "profiles" ||
    appStore.screen === "coverage"
  );

  const isSettingsActive = $derived(appStore.screen === "settings");

  let flyoutOpen = $state(false);
  let learnButtonEl = $state<HTMLButtonElement | null>(null);
  let closeTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  /** Pixel position for the flyout, anchored to the button. */
  let flyoutTop = $state(0);
  let flyoutLeft = $state(0);

  function scheduleClose() {
    closeTimer = setTimeout(() => { flyoutOpen = false; }, 150);
  }

  function cancelClose() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function openFlyout() {
    cancelClose();
    if (learnButtonEl) {
      const rect = learnButtonEl.getBoundingClientRect();
      flyoutTop = rect.top;
      flyoutLeft = RAIL_WIDTH;
    }
    flyoutOpen = true;
  }

  function handleZoneEnter() {
    openFlyout();
  }

  function handleZoneLeave() {
    scheduleClose();
  }

  function handleFlyoutEnter() {
    cancelClose();
  }

  function handleFlyoutLeave() {
    scheduleClose();
  }

  function handleLearnClick() {
    appStore.navigateToLearningHome();
    flyoutOpen = false;
  }

  function handleLearnKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!flyoutOpen) {
        openFlyout();
      } else {
        handleLearnClick();
      }
    } else if (e.key === "Escape") {
      flyoutOpen = false;
    }
  }

  const flyoutItems = $derived(
    createLearnSubItems(appStore.screen, {
      toConventions: () => { appStore.navigateToLearningHome(); flyoutOpen = false; },
      toProfiles: () => { appStore.navigateToProfiles(); flyoutOpen = false; },
    }),
  );
</script>

<nav
  class="h-full bg-bg-base border-r border-border-subtle flex flex-col items-center py-4 gap-1 shrink-0"
  style="width: {RAIL_WIDTH}px;"
  aria-label="Main navigation"
>
  <!-- Home -->
  <button
    class="flex flex-col items-center gap-0.5 py-2 w-full transition-colors cursor-pointer
      {isHomeActive
        ? 'text-accent-primary'
        : 'text-text-muted hover:text-text-primary'}"
    aria-label="Home"
    aria-current={isHomeActive ? "page" : undefined}
    onclick={() => appStore.navigateToConventions()}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
    <span class="text-[10px] font-medium leading-none">Home</span>
  </button>

  <!-- Learn — hover zone covers full rail width so there's no dead gap -->
  <div
    class="w-full"
    onpointerenter={handleZoneEnter}
    onpointerleave={handleZoneLeave}
  >
    <button
      bind:this={learnButtonEl}
      class="flex flex-col items-center gap-0.5 py-2 w-full transition-colors cursor-pointer
        {isLearnActive
          ? 'text-accent-primary'
          : 'text-text-muted hover:text-text-primary'}"
      aria-label="Learn"
      aria-current={isLearnActive ? "page" : undefined}
      onclick={handleLearnClick}
      onkeydown={handleLearnKeydown}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
      <span class="text-[10px] font-medium leading-none">Learn</span>
    </button>
  </div>

  <!-- Settings -->
  <button
    class="flex flex-col items-center gap-0.5 py-2 w-full transition-colors cursor-pointer
      {isSettingsActive
        ? 'text-accent-primary'
        : 'text-text-muted hover:text-text-primary'}"
    aria-label="Settings"
    aria-current={isSettingsActive ? "page" : undefined}
    onclick={() => appStore.navigateToSettings()}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
    <span class="text-[10px] font-medium leading-none">Settings</span>
  </button>
</nav>

<!-- Flyout rendered fixed, outside the nav's stacking context -->
{#if flyoutOpen}
  <div
    class="fixed z-50"
    style="top: {flyoutTop}px; left: {flyoutLeft}px;"
    onpointerenter={handleFlyoutEnter}
    onpointerleave={handleFlyoutLeave}
  >
    <NavFlyout items={flyoutItems} />
  </div>
{/if}
