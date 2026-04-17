<script lang="ts">
  import { page } from "$app/state";
  import { getAppStoreOptional, getAuthStoreOptional } from "../../stores/context";
  import AuthModal from "../shared/AuthModal.svelte";
  import { getNavItems, isItemActive, type NavItem } from "./nav-items";

  const appStore = getAppStoreOptional();
  const auth = getAuthStoreOptional();

  let authModal = $state<ReturnType<typeof AuthModal>>();

  const initial = $derived(
    auth?.user?.display_name?.charAt(0).toUpperCase() ?? null,
  );

  const pathname = $derived(page.url.pathname);
  const items = getNavItems();

  function handleClear(item: NavItem) {
    if (!appStore) return;
    if (item.clearAction === "selection") appStore.clearSelection();
    else if (item.clearAction === "workshop") appStore.clearWorkshopState();
  }
</script>

<nav
  class="sticky top-0 h-screen bg-bg-base border-r border-border-subtle flex flex-col items-center py-4 gap-1 shrink-0 z-[var(--z-modal)]"
  style="width: 80px;"
  aria-label="Main navigation"
>
  <a
    href="/"
    class="flex items-center justify-center py-2 mb-1 w-full"
    aria-label="BridgeLab home"
  >
    <img src="/brand/logo.svg" alt="" class="w-9 h-9" />
  </a>
  {#each items as item (item.href)}
    {@const active = isItemActive(item, pathname)}
    {#if item.href === "/practice"}
      <div class="relative w-full group">
        <a
          href={item.href}
          class="flex flex-col items-center gap-0.5 py-2 w-full transition-colors no-underline
            {active ? 'text-accent-primary' : 'text-text-muted hover:text-text-primary'}"
          aria-label={item.label}
          aria-current={active ? "page" : undefined}
          onclick={() => handleClear(item)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted static icon markup -->
            {@html item.iconSvg}
          </svg>
          <span class="text-[10px] font-medium leading-none">{item.label}</span>
        </a>
        <div
          class="absolute left-full top-0
                 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible
                 transition-opacity z-[var(--z-modal)]"
          role="menu"
          aria-label="Practice sections"
        >
          <div class="min-w-[180px] bg-bg-elevated border border-border-default rounded-[--radius-md] shadow-lg py-1">
            {#each [
              { href: "/practice", label: "Quick Practice" },
              { href: "/practice/drill", label: "Drills" },
            ] as const as sub (sub.href)}
              <a
                href={sub.href}
                class="block px-3 py-2 text-sm text-text-primary hover:bg-bg-hover no-underline"
                role="menuitem"
                onclick={() => handleClear(item)}
              >
                {sub.label}
              </a>
            {/each}
          </div>
        </div>
      </div>
    {:else if item.href === "/learn"}
      <div class="relative w-full group">
        <a
          href={item.href}
          class="flex flex-col items-center gap-0.5 py-2 w-full transition-colors no-underline
            {active ? 'text-accent-primary' : 'text-text-muted hover:text-text-primary'}"
          aria-label={item.label}
          aria-current={active ? "page" : undefined}
          onclick={() => handleClear(item)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted static icon markup -->
            {@html item.iconSvg}
          </svg>
          <span class="text-[10px] font-medium leading-none">{item.label}</span>
        </a>
        <!-- Hover flyout: sits flush against the rail (no gap) so mouse travel
             from rail to menu never crosses dead space. -->
        <div
          class="absolute left-full top-0
                 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible
                 transition-opacity z-[var(--z-modal)]"
          role="menu"
          aria-label="Learn sections"
        >
          <div class="min-w-[180px] bg-bg-elevated border border-border-default rounded-[--radius-md] shadow-lg py-1">
            {#each [
              { href: "/learn", label: "Conventions" },
              { href: "/lessons", label: "Lessons" },
              { href: "/systems", label: "Bidding Systems" },
            ] as const as sub (sub.href)}
              <a
                href={sub.href}
                class="block px-3 py-2 text-sm text-text-primary hover:bg-bg-hover no-underline"
                role="menuitem"
                onclick={() => handleClear(item)}
              >
                {sub.label}
              </a>
            {/each}
          </div>
        </div>
      </div>
    {:else}
      <a
        href={item.href}
        class="flex flex-col items-center gap-0.5 py-2 w-full transition-colors no-underline
          {active ? 'text-accent-primary' : 'text-text-muted hover:text-text-primary'}"
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        onclick={() => handleClear(item)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted static icon markup -->
          {@html item.iconSvg}
        </svg>
        <span class="text-[10px] font-medium leading-none">{item.label}</span>
      </a>
    {/if}
  {/each}

  <!-- User / Login -->
  {#if auth}
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
  {/if}
</nav>
