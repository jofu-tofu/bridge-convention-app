<script lang="ts">
  import { page } from "$app/state";
  import { getAppStore, getAuthStore } from "../../stores/context";
  import { FEATURES } from "../../stores/feature-flags";
  import AuthModal from "../shared/AuthModal.svelte";

  const appStore = getAppStore();
  const auth = getAuthStore();

  let authModal = $state<ReturnType<typeof AuthModal>>();

  const initial = $derived(
    auth.user?.display_name?.charAt(0).toUpperCase() ?? null,
  );

  const pathname = $derived(page.url.pathname);
  const isHomeActive = $derived(pathname === "/" || pathname === "/game");
  const isLearnActive = $derived(pathname === "/learning" || pathname === "/coverage");
  const isWorkshopActive = $derived(
    pathname === "/workshop" ||
    pathname === "/convention-editor" || pathname === "/practice-pack-editor"
  );
  const isGuidesActive = $derived(pathname === "/guides");
  const isSettingsActive = $derived(pathname === "/settings");
</script>

<nav
  class="h-full bg-bg-base border-r border-border-subtle flex flex-col items-center py-4 gap-1 shrink-0"
  style="width: 80px;"
  aria-label="Main navigation"
>
  <!-- Home -->
  <a
    href="/"
    class="flex flex-col items-center gap-0.5 py-2 w-full transition-colors no-underline
      {isHomeActive
        ? 'text-accent-primary'
        : 'text-text-muted hover:text-text-primary'}"
    aria-label="Home"
    aria-current={isHomeActive ? "page" : undefined}
    onclick={() => appStore.clearSelection()}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
    <span class="text-[10px] font-medium leading-none">Home</span>
  </a>

  <!-- Learn — direct navigation, no flyout -->
  <a
    href="/learning"
    class="flex flex-col items-center gap-0.5 py-2 w-full transition-colors no-underline
      {isLearnActive
        ? 'text-accent-primary'
        : 'text-text-muted hover:text-text-primary'}"
    aria-label="Learn"
    aria-current={isLearnActive ? "page" : undefined}
    onclick={() => appStore.clearLearningState()}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
    <span class="text-[10px] font-medium leading-none">Learn</span>
  </a>

  <!-- Guides -->
  <a
    href="/guides"
    class="flex flex-col items-center gap-0.5 py-2 w-full transition-colors no-underline
      {isGuidesActive
        ? 'text-accent-primary'
        : 'text-text-muted hover:text-text-primary'}"
    aria-label="Guides"
    aria-current={isGuidesActive ? "page" : undefined}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/></svg>
    <span class="text-[10px] font-medium leading-none">Guides</span>
  </a>

  <!-- Workshop (dev only) -->
  {#if FEATURES.workshop}
    <a
      href="/workshop"
      class="flex flex-col items-center gap-0.5 py-2 w-full transition-colors no-underline
        {isWorkshopActive
          ? 'text-accent-primary'
          : 'text-text-muted hover:text-text-primary'}"
      aria-label="Workshop"
      aria-current={isWorkshopActive ? "page" : undefined}
      onclick={() => appStore.clearWorkshopState()}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
      <span class="text-[10px] font-medium leading-none">Workshop</span>
    </a>
  {/if}

  <!-- Settings -->
  <a
    href="/settings"
    class="flex flex-col items-center gap-0.5 py-2 w-full transition-colors no-underline
      {isSettingsActive
        ? 'text-accent-primary'
        : 'text-text-muted hover:text-text-primary'}"
    aria-label="Settings"
    aria-current={isSettingsActive ? "page" : undefined}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
    <span class="text-[10px] font-medium leading-none">Settings</span>
  </a>

  <!-- User / Login -->
  <div class="mt-auto pb-2">
    <button
      class="flex flex-col items-center gap-0.5 py-2 w-full transition-colors cursor-pointer text-text-muted hover:text-text-primary"
      aria-label={auth.isLoggedIn ? "Account" : "Sign in"}
      onclick={() => authModal?.open()}
    >
      {#if auth.isLoggedIn && auth.user?.avatar_url}
        <img
          src={auth.user.avatar_url}
          alt=""
          class="w-7 h-7 rounded-full object-cover"
        />
      {:else if auth.isLoggedIn && initial}
        <div class="w-7 h-7 rounded-full bg-accent-primary flex items-center justify-center text-xs font-bold text-text-on-accent">
          {initial}
        </div>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span class="text-[10px] font-medium leading-none">Sign in</span>
      {/if}
    </button>
  </div>
  <AuthModal bind:this={authModal} />
</nav>
