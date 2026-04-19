<script lang="ts">
  import { goto } from "$app/navigation";
  import {
    AVAILABLE_BASE_SYSTEMS,
    PracticeMode,
    PracticeRole,
    displayConventionName,
    listConventions,
  } from "../../../../service";
  import type { SystemSelectionId } from "../../../../service";
  import AppScreen from "../../../../components/shared/AppScreen.svelte";
  import PaywallOverlay from "../../../../components/shared/PaywallOverlay.svelte";
  import {
    getAppStore,
    getAuthStoreOptional,
    getCustomSystemsStore,
    getDrillsStore,
  } from "../../../../stores/context";
  import { canPractice } from "../../../../stores/entitlements";
  import type { Drill } from "../../../../stores/drills.svelte";

  const appStore = getAppStore();
  const customSystems = getCustomSystemsStore();
  const drillsStore = getDrillsStore();
  const authStore = getAuthStoreOptional();
  const allConventions = listConventions();

  const drills = $derived(drillsStore.drills);
  const loadStatus = $derived(drillsStore.loadStatus);
  const showLoadError = $derived(loadStatus === "auth-load-error");

  const MERGE_INFO_KEY = "bridge-app:drill-merge-info-dismissed";
  let mergeInfoDismissed = $state(readMergeInfoDismissed());
  let paywall = $state<ReturnType<typeof PaywallOverlay>>();

  function readMergeInfoDismissed(): boolean {
    try {
      return localStorage.getItem(MERGE_INFO_KEY) === "1";
    } catch {
      return false;
    }
  }

  function dismissMergeInfo(): void {
    try {
      localStorage.setItem(MERGE_INFO_KEY, "1");
    } catch {
      // ignore
    }
    mergeInfoDismissed = true;
  }

  function readAnonymousDrillCount(): number {
    try {
      const raw = localStorage.getItem("bridge-app:drills");
      if (!raw) return 0;
      const parsed = JSON.parse(raw) as { drills?: unknown };
      if (!parsed || !Array.isArray(parsed.drills)) return 0;
      return parsed.drills.length;
    } catch {
      return 0;
    }
  }

  const showMergeInfoBanner = $derived.by(() => {
    if (!authStore?.user) return false;
    if (mergeInfoDismissed) return false;
    return readAnonymousDrillCount() > 0;
  });

  function conventionName(id: string): string {
    const match = allConventions.find((convention) => convention.id === id);
    return match ? displayConventionName(match.name) : id;
  }

  function conventionSummary(drill: Drill): string {
    if (drill.moduleIds.length === 1) {
      return conventionName(drill.moduleIds[0] ?? "");
    }
    return drill.moduleIds.map(conventionName).join(" + ");
  }

  function modeLabel(mode: PracticeMode): string {
    switch (mode) {
      case PracticeMode.FullAuction:
        return "Full auction";
      case PracticeMode.Learn:
        return "Learn";
      default:
        return "Decision";
    }
  }

  function roleLabel(role: PracticeRole | "auto"): string {
    if (role === "auto") return "Auto";
    switch (role) {
      case PracticeRole.Opener:
        return "Opener";
      case PracticeRole.Responder:
        return "Responder";
      default:
        return "Both";
    }
  }

  function systemLabel(id: SystemSelectionId): string {
    const base = AVAILABLE_BASE_SYSTEMS.find((system) => system.id === id);
    if (base) return base.shortLabel;
    const custom = customSystems.systems.find((system) => system.id === id);
    return custom?.name ?? id;
  }

  function ago(iso: string | null): string {
    if (!iso) return "Never launched";
    const elapsedMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.max(1, Math.floor(elapsedMs / 60000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function lockedModuleIds(drill: Drill): string[] {
    return drill.moduleIds.filter((id) => !canPractice(authStore?.user ?? null, id));
  }

  function customSystemUnavailable(drill: Drill): boolean {
    if (!drill.systemSelectionId.startsWith("custom:")) return false;
    return !customSystems.systems.some((system) => system.id === drill.systemSelectionId);
  }

  async function launch(drill: Drill): Promise<void> {
    const blocked = lockedModuleIds(drill);
    if (blocked.length > 0) {
      paywall?.open();
      return;
    }
    const firstConvention = allConventions.find((convention) => convention.id === drill.moduleIds[0]);
    if (!firstConvention) return;

    void drillsStore.markLaunched(drill.id);
    appStore.selectConvention(firstConvention);
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
    await goto("/game");
  }

  async function remove(drill: Drill): Promise<void> {
    if (!confirm(`Delete "${drill.name}"?`)) return;
    await drillsStore.delete(drill.id);
  }

  async function retryLoad(): Promise<void> {
    await drillsStore.refresh();
  }

  const createDisabled = $derived(showLoadError);
</script>

<AppScreen title="Saved drills" subtitle="Create, edit, and launch your saved practice setups.">
  {#snippet actions()}
    {#if createDisabled}
      <button
        type="button"
        disabled
        class="inline-flex items-center rounded-[--radius-md] bg-accent-primary/40 px-3 py-1.5 text-sm font-medium text-text-on-accent cursor-not-allowed"
        data-testid="drills-create-disabled"
      >
        Create new
      </button>
    {:else}
      <a
        href="/practice/drills/new"
        class="inline-flex items-center rounded-[--radius-md] bg-accent-primary px-3 py-1.5 text-sm font-medium text-text-on-accent no-underline hover:bg-accent-primary-hover"
      >
        Create new
      </a>
    {/if}
  {/snippet}

  {#if showLoadError}
    <div
      class="mb-4 rounded-[--radius-md] border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
      data-testid="drills-load-error-banner"
      role="alert"
    >
      <p class="font-medium">Couldn't load your drills — tap to retry.</p>
      <button
        type="button"
        class="mt-2 inline-flex items-center rounded-[--radius-md] border border-red-400/40 px-3 py-1 text-xs font-medium text-red-200 hover:bg-red-500/20 cursor-pointer"
        onclick={() => void retryLoad()}
        data-testid="drills-load-error-retry"
      >
        Retry
      </button>
    </div>
  {/if}

  {#if showMergeInfoBanner}
    <div
      class="mb-4 rounded-[--radius-md] border border-border-subtle bg-bg-base px-4 py-3 text-sm text-text-secondary"
      data-testid="drills-merge-info-banner"
    >
      <div class="flex items-start justify-between gap-3">
        <p>
          You have drills saved on this device. Sign out to access them — they won't sync to your
          account automatically.
        </p>
        <button
          type="button"
          class="text-xs font-medium text-accent-primary hover:text-accent-primary-hover cursor-pointer"
          onclick={dismissMergeInfo}
          data-testid="drills-merge-info-dismiss"
        >
          Dismiss
        </button>
      </div>
    </div>
  {/if}

  {#if drills.length === 0 && !showLoadError}
    <div class="rounded-[--radius-xl] border border-dashed border-border-subtle px-6 py-16 text-center">
      <p class="text-base text-text-primary">No saved drills yet</p>
      <a
        href="/practice/drills/new"
        class="mt-4 inline-flex items-center rounded-[--radius-md] border border-border-subtle px-3 py-1.5 text-sm font-medium text-text-primary no-underline hover:border-border-default"
      >
        Create new
      </a>
    </div>
  {:else}
    <div class="space-y-3">
      {#each drills as drill (drill.id)}
        {@const blocked = lockedModuleIds(drill)}
        {@const customMissing = customSystemUnavailable(drill)}
        <article class="rounded-[--radius-xl] border border-border-subtle bg-bg-card p-4 shadow-sm">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 space-y-1">
              <h2 class="flex flex-wrap items-center gap-2 text-base font-semibold text-text-primary">
                <span>{drill.name}</span>
                {#if blocked.length > 0}
                  <span
                    class="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200"
                    data-testid="drills-lock-badge-{drill.id}"
                    title="This drill includes paid conventions"
                  >
                    Locked
                  </span>
                {/if}
              </h2>
              <p class="text-sm text-text-secondary">{conventionSummary(drill)}</p>
              <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
                <span>{drill.moduleIds.length} convention{drill.moduleIds.length === 1 ? "" : "s"}</span>
                <span>{modeLabel(drill.practiceMode)}</span>
                <span>{roleLabel(drill.practiceRole)}</span>
                <span>{systemLabel(drill.systemSelectionId)}</span>
                <span>Last used {ago(drill.lastUsedAt)}</span>
              </div>
              {#if customMissing}
                <p
                  class="mt-1 text-xs text-amber-300"
                  data-testid="drills-custom-system-missing-{drill.id}"
                >
                  Custom system not available on this device
                </p>
              {/if}
            </div>

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-[--radius-md] bg-accent-primary px-3 py-1.5 text-sm font-medium text-text-on-accent hover:bg-accent-primary-hover cursor-pointer"
                onclick={() => void launch(drill)}
              >
                Launch
              </button>
              <a
                href={`/practice/drills/${drill.id}/edit`}
                class="rounded-[--radius-md] border border-border-subtle px-3 py-1.5 text-sm font-medium text-text-primary no-underline hover:border-border-default"
              >
                Edit
              </a>
              <button
                type="button"
                class="rounded-[--radius-md] border border-border-subtle px-3 py-1.5 text-sm font-medium text-red-400 hover:border-red-400/40 cursor-pointer"
                onclick={() => void remove(drill)}
              >
                Delete
              </button>
            </div>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</AppScreen>

<PaywallOverlay bind:this={paywall} />
