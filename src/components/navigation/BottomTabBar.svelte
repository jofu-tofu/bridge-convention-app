<script lang="ts">
  import { getAppStore } from "../../stores/context";

  const appStore = getAppStore();

  const isHomeActive = $derived(appStore.screen === "conventions" || appStore.screen === "game");
  const isLearnActive = $derived(appStore.screen === "learning" || appStore.screen === "coverage");
  const isWorkshopActive = $derived(
    appStore.screen === "workshop" ||
    appStore.screen === "convention-editor" || appStore.screen === "practice-pack-editor"
  );
  const isSettingsActive = $derived(appStore.screen === "settings");
</script>

<nav
  class="h-14 bg-bg-base border-t border-border-subtle flex items-center justify-around shrink-0"
  style="padding-bottom: env(safe-area-inset-bottom)"
  aria-label="Main navigation"
>
  <button
    class="flex flex-col items-center gap-0.5 px-4 py-1.5 transition-colors cursor-pointer
      {isHomeActive ? 'text-accent-primary' : 'text-text-muted'}"
    aria-label="Home"
    aria-current={isHomeActive ? "page" : undefined}
    onclick={() => appStore.navigateToConventions()}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
    <span class="text-xs font-medium">Home</span>
  </button>

  <button
    class="flex flex-col items-center gap-0.5 px-4 py-1.5 transition-colors cursor-pointer
      {isLearnActive ? 'text-accent-primary' : 'text-text-muted'}"
    aria-label="Learn"
    aria-current={isLearnActive ? "page" : undefined}
    onclick={() => appStore.navigateToLearningHome()}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
    <span class="text-xs font-medium">Learn</span>
  </button>

  <button
    class="flex flex-col items-center gap-0.5 px-4 py-1.5 transition-colors cursor-pointer
      {isWorkshopActive ? 'text-accent-primary' : 'text-text-muted'}"
    aria-label="Workshop"
    aria-current={isWorkshopActive ? "page" : undefined}
    onclick={() => appStore.navigateToWorkshop()}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
    <span class="text-xs font-medium">Workshop</span>
  </button>

  <button
    class="flex flex-col items-center gap-0.5 px-4 py-1.5 transition-colors cursor-pointer
      {isSettingsActive ? 'text-accent-primary' : 'text-text-muted'}"
    aria-label="Settings"
    aria-current={isSettingsActive ? "page" : undefined}
    onclick={() => appStore.navigateToSettings()}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
    <span class="text-xs font-medium">Settings</span>
  </button>
</nav>
