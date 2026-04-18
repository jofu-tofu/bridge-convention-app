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
  import { getAppStore, getCustomSystemsStore, getDrillsStore } from "../../../../stores/context";
  import type { Drill } from "../../../../stores/drills.svelte";

  const appStore = getAppStore();
  const customSystems = getCustomSystemsStore();
  const drillsStore = getDrillsStore();
  const allConventions = listConventions();

  const drills = $derived(drillsStore.drills);

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

  async function launch(drill: Drill): Promise<void> {
    const firstConvention = allConventions.find((convention) => convention.id === drill.moduleIds[0]);
    if (!firstConvention) return;

    drillsStore.markLaunched(drill.id);
    appStore.selectConvention(firstConvention);
    appStore.applyDrillSession(
      {
        moduleIds: drill.moduleIds,
        practiceMode: drill.practiceMode,
        practiceRole: drill.practiceRole,
        systemSelectionId: drill.systemSelectionId,
        sourceDrillId: drill.id,
      },
      allConventions,
    );
    await goto("/game");
  }

  function remove(drill: Drill): void {
    if (!confirm(`Delete "${drill.name}"?`)) return;
    drillsStore.delete(drill.id);
  }
</script>

<AppScreen title="Saved drills" subtitle="Create, edit, and launch your saved practice setups.">
  {#snippet actions()}
    <a
      href="/practice/drills/new"
      class="inline-flex items-center rounded-[--radius-md] bg-accent-primary px-3 py-1.5 text-sm font-medium text-text-on-accent no-underline hover:bg-accent-primary-hover"
    >
      Create new
    </a>
  {/snippet}

  {#if drills.length === 0}
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
        <article class="rounded-[--radius-xl] border border-border-subtle bg-bg-card p-4 shadow-sm">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 space-y-1">
              <h2 class="text-base font-semibold text-text-primary">{drill.name}</h2>
              <p class="text-sm text-text-secondary">{conventionSummary(drill)}</p>
              <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
                <span>{drill.moduleIds.length} convention{drill.moduleIds.length === 1 ? "" : "s"}</span>
                <span>{modeLabel(drill.practiceMode)}</span>
                <span>{roleLabel(drill.practiceRole)}</span>
                <span>{systemLabel(drill.systemSelectionId)}</span>
                <span>Last used {ago(drill.lastUsedAt)}</span>
              </div>
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
                onclick={() => remove(drill)}
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
