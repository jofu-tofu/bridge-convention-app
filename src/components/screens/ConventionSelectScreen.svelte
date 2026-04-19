<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { listConventions, ConventionCategory, displayConventionName, PracticeMode, PracticeRole } from "../../service";
  import type { ConventionInfo } from "../../service";
  import { getAppStore, getAuthStore, getDrillsStore } from "../../stores/context";
  import { canPractice } from "../../stores/entitlements";
  import type { Drill } from "../../stores/drills.svelte";
  import AuthModal from "../shared/AuthModal.svelte";
  import PaywallOverlay from "../shared/PaywallOverlay.svelte";
  import { filterConventions } from "./filter-conventions";
  import ItemCard from "../shared/ItemCard.svelte";
  import SectionHeader from "../shared/SectionHeader.svelte";
  import SavedDrillsShelf from "./SavedDrillsShelf.svelte";
  import QuickPracticeSettingsPanel from "./QuickPracticeSettingsPanel.svelte";
  import AppScreen from "../shared/AppScreen.svelte";
  import { DESKTOP_MIN } from "../shared/breakpoints.svelte";

  const appStore = getAppStore();
  const auth = getAuthStore();
  const drillsStore = getDrillsStore();

  let authModal = $state<ReturnType<typeof AuthModal>>();
  let paywallOverlay = $state<ReturnType<typeof PaywallOverlay>>();

  let innerW = $state(window.innerWidth);
  const isMobile = $derived(innerW < DESKTOP_MIN);
  let mobileSettingsOpen = $state(false);

  const initial = $derived(
    auth.user?.display_name?.charAt(0).toUpperCase() ?? null,
  );

  let searchQuery = $state("");

  const showMyDrillsLink = $derived(page.url.pathname === "/practice");

  const allConventions = $derived(listConventions());

  const filteredConventions = $derived(
    filterConventions(allConventions, searchQuery, null),
  );

  const groupedConventions = $derived(
    Object.values(ConventionCategory)
      .map((category) => ({
        category,
        items: filteredConventions.filter((c) => c.category === category),
      }))
      .filter((group) => group.items.length > 0),
  );

  function handleSelect(config: ConventionInfo) {
    if (!canPractice(auth.user, config.id)) {
      paywallOverlay?.open();
      return;
    }

    const practiceRole =
      appStore.practiceRole === "auto" ? config.defaultRole : appStore.practiceRole;

    appStore.selectConvention(config);
    appStore.applyDrillSession(
      {
        moduleIds: [config.id],
        practiceMode: appStore.userPracticeMode ?? PracticeMode.DecisionDrill,
        practiceRole,
        systemSelectionId: appStore.baseSystemId,
        opponentMode: appStore.opponentMode,
        playProfileId: appStore.playProfileId ?? "world-class",
        vulnerabilityDistribution: appStore.drillTuning.vulnerabilityDistribution,
        showEducationalAnnotations: appStore.displaySettings.showEducationalAnnotations,
        sourceDrillId: null,
      },
      allConventions,
    );
    void goto("/game");
  }

  function launchDrill(drill: Drill) {
    const conventionId = drill.moduleIds[0];
    if (!conventionId) return;
    const convention = allConventions.find((c) => c.id === conventionId);
    if (!convention) return;
    if (!canPractice(auth.user, convention.id)) {
      paywallOverlay?.open();
      return;
    }
    drillsStore.markLaunched(drill.id);
    appStore.selectConvention(convention);
    appStore.applyDrillSession(
      {
        moduleIds: drill.moduleIds,
        practiceMode: drill.practiceMode,
        practiceRole: drill.practiceRole,
        systemSelectionId: drill.systemSelectionId,
        opponentMode: drill.opponentMode,
        playProfileId: drill.playProfileId,
        vulnerabilityDistribution: drill.vulnerabilityDistribution,
        showEducationalAnnotations: drill.showEducationalAnnotations,
        sourceDrillId: drill.id,
      },
      allConventions,
    );
    void goto("/game");
  }

  function openEditDrill(drillId: string): void {
    void goto(`/practice/drills/${drillId}/edit`);
  }

  const displayName = displayConventionName;

  function roleBadgeLabel(role: PracticeRole): string {
    switch (role) {
      case PracticeRole.Opener:
        return "Opener";
      case PracticeRole.Responder:
        return "Responder";
      case PracticeRole.Both:
        return "Opener or responder";
    }
  }
</script>

<svelte:window bind:innerWidth={innerW} />

<AppScreen title="Practice" scroll={false} contentClass="flex flex-col">
  {#snippet actions()}
      {#if isMobile}
        <button
          class="shrink-0 ml-4 mt-1 transition-colors cursor-pointer text-text-muted hover:text-text-primary"
          aria-label={auth.isLoggedIn ? "Account" : "Sign in"}
          onclick={() => authModal?.open()}
        >
          {#if auth.isLoggedIn && auth.user?.avatar_url}
            <img
              src={auth.user.avatar_url}
              alt=""
              class="w-8 h-8 rounded-full object-cover"
            />
          {:else if auth.isLoggedIn && initial}
            <div class="w-8 h-8 rounded-full bg-accent-primary flex items-center justify-center text-sm font-bold text-text-on-accent">
              {initial}
            </div>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          {/if}
        </button>
      {/if}
  {/snippet}

  <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_20rem] flex-1 min-h-0">
    <div class="min-w-0 overflow-y-auto min-h-0 pb-4">
      {#if showMyDrillsLink}
        <div class="mb-2 flex justify-end">
          <a
            href="/practice/drills"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[--radius-md] text-xs font-medium text-text-secondary border border-border-subtle bg-bg-card no-underline transition-all hover:text-text-primary hover:border-border-default hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
          >
            My drills
            <span aria-hidden="true" class="text-accent-primary">→</span>
          </a>
        </div>
      {/if}

      <div class="mb-4">
        <div
          class="flex items-center gap-3 bg-bg-card border border-border-subtle rounded-[--radius-lg] px-4 py-3 transition-colors focus-within:border-accent-primary/40"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-text-muted shrink-0"
            aria-hidden="true"
            ><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg
          >
          <input
            type="text"
            placeholder="Search conventions..."
            aria-label="Search conventions"
            bind:value={searchQuery}
            class="w-full bg-transparent text-text-primary placeholder-text-muted outline-none"
          />
        </div>
      </div>

      {#if !searchQuery}
        <SavedDrillsShelf onLaunch={launchDrill} onEdit={openEditDrill} />
      {/if}

      {#if filteredConventions.length > 0}
        {#each groupedConventions as group (group.category)}
          <section class="mb-6">
            <SectionHeader level="h2">{group.category}</SectionHeader>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {#each group.items as convention (convention.id)}
                <ItemCard testId="convention-{convention.id}" interactive={false} class="!rounded-[--radius-xl]">
                  <div class="flex items-start justify-between gap-2">
                    <h2 class="text-lg font-semibold text-text-primary leading-tight">
                      {displayName(convention.name)}
                    </h2>
                    <div class="flex flex-wrap justify-end gap-1.5 shrink-0">
                      <span class="text-xs font-medium text-text-muted bg-bg-elevated rounded-full px-2 py-0.5">
                        {roleBadgeLabel(convention.defaultRole)}
                      </span>
                      {#if convention.variesBySystem}
                        <span class="text-xs font-medium text-text-muted bg-bg-elevated rounded-full px-2 py-0.5">
                          Varies by system
                        </span>
                      {/if}
                    </div>
                  </div>
                  <p class="text-sm text-text-secondary mt-1 leading-relaxed line-clamp-2">
                    {convention.description}
                  </p>
                  {@const locked = !canPractice(auth.user, convention.id)}
                  <div class="flex items-center justify-end gap-1.5 mt-2">
                    <button
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-[--radius-md] text-xs font-medium
                        transition-all shadow-sm
                        {locked
                          ? 'text-text-muted bg-bg-elevated cursor-pointer border border-border-subtle'
                          : 'text-text-on-accent bg-accent-primary hover:bg-accent-primary-hover cursor-pointer'}"
                      data-testid="practice-{convention.id}"
                      aria-label="{locked ? 'Unlock' : 'Practice'} {displayName(convention.name)}"
                      onclick={() => handleSelect(convention)}
                    >
                      {#if locked}
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      {:else}
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      {/if}
                      <span class="hidden sm:inline">{locked ? "Locked" : "Practice"}</span>
                    </button>
                    <a
                      class="flex items-center justify-center p-1.5 rounded-[--radius-md] text-xs font-medium
                        text-text-secondary bg-bg-elevated hover:text-accent-primary hover:bg-accent-primary/10
                        transition-all cursor-pointer border border-transparent hover:border-accent-primary/20
                        min-w-[--size-touch-target] min-h-[--size-touch-target]"
                      data-testid="configure-{convention.id}"
                      aria-label="Configure and save drill for {displayName(convention.name)}"
                      href={`/practice/drills/new?convention=${encodeURIComponent(convention.id)}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>
                    </a>
                  </div>
                </ItemCard>
              {/each}
            </div>
          </section>
        {/each}
      {:else}
        <div class="text-center py-12">
          <p class="text-text-muted">No conventions match your search.</p>
        </div>
      {/if}
    </div>

    <aside class="hidden md:flex md:flex-col min-h-0 overflow-y-auto pb-4">
      <QuickPracticeSettingsPanel />
    </aside>
  </div>

  {#if isMobile}
    <button
      type="button"
      class="fixed right-0 top-1/2 z-30 -translate-y-1/2 rounded-l-[--radius-md] border border-r-0 border-border-subtle bg-bg-card px-2 py-3 text-xs font-semibold text-text-primary shadow-md cursor-pointer"
      aria-label="Open practice settings"
      aria-expanded={mobileSettingsOpen}
      aria-controls="mobile-practice-settings"
      onclick={() => (mobileSettingsOpen = true)}
    >
      <span class="[writing-mode:vertical-rl] [transform:rotate(180deg)]">Settings</span>
    </button>

    {#if mobileSettingsOpen}
      <div
        class="fixed inset-0 z-40 bg-black/50"
        role="button"
        tabindex="0"
        aria-label="Close practice settings"
        onclick={() => (mobileSettingsOpen = false)}
        onkeydown={(e) => {
          if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
            mobileSettingsOpen = false;
          }
        }}
      ></div>
      <aside
        id="mobile-practice-settings"
        class="fixed right-0 top-0 z-50 flex h-full w-[min(20rem,90vw)] flex-col overflow-y-auto border-l border-border-subtle bg-bg-card shadow-xl"
      >
        <div class="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <span class="text-sm font-semibold text-text-primary">Practice settings</span>
          <button
            type="button"
            class="rounded-[--radius-md] p-1 text-text-muted hover:text-text-primary cursor-pointer"
            aria-label="Close practice settings"
            onclick={() => (mobileSettingsOpen = false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="p-3">
          <QuickPracticeSettingsPanel showHeader={false} />
        </div>
      </aside>
    {/if}
  {/if}

  <AuthModal bind:this={authModal} />
  <PaywallOverlay bind:this={paywallOverlay} />
</AppScreen>
