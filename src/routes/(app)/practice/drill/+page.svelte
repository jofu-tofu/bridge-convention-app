<script lang="ts">
  import { AVAILABLE_BASE_SYSTEMS, PracticeRole, displayConventionName, listConventions } from "../../../../service";
  import type { SystemSelectionId } from "../../../../service";
  import { getCustomDrillsStore, getCustomSystemsStore } from "../../../../stores/context";

  const drillsStore = getCustomDrillsStore();
  const customSystems = getCustomSystemsStore();
  const allConventions = listConventions();

  function conventionName(id: string): string {
    const c = allConventions.find((x) => x.id === id);
    return c ? displayConventionName(c.name) : id;
  }

  function systemLabel(id: SystemSelectionId): string {
    const base = AVAILABLE_BASE_SYSTEMS.find((s) => s.id === id);
    if (base) return base.shortLabel;
    const custom = customSystems.systems.find((s) => s.id === id);
    return custom?.name ?? id;
  }

  function roleLabel(r: PracticeRole): string {
    if (r === PracticeRole.Opener) return "Opener";
    if (r === PracticeRole.Responder) return "Responder";
    return "Both";
  }

  function onDelete(id: string, name: string): void {
    if (confirm(`Delete "${name}"?`)) drillsStore.delete(id);
  }
</script>

<main class="max-w-3xl mx-auto h-full overflow-y-auto p-4">
  <header class="flex items-start justify-between mb-6">
    <div>
      <h1 class="text-xl font-semibold text-text-primary">My drills</h1>
      <p class="text-sm text-text-muted mt-1">Drills you've configured. Launching lands in a later update.</p>
    </div>
    <a
      href="/practice/drill/new"
      class="px-3 py-1.5 rounded-[--radius-md] text-sm font-medium bg-accent-primary text-text-on-accent hover:bg-accent-primary-hover no-underline"
    >New drill</a>
  </header>

  {#if drillsStore.drills.length === 0}
    <div class="text-center py-16 border border-dashed border-border-subtle rounded-[--radius-lg]">
      <p class="text-text-muted mb-4">No custom drills yet.</p>
      <a
        href="/practice/drill/new"
        class="inline-block px-3 py-1.5 rounded-[--radius-md] text-sm font-medium border border-border-subtle text-text-primary hover:border-border-prominent no-underline"
      >Create your first drill</a>
    </div>
  {:else}
    <ul class="space-y-2">
      {#each drillsStore.drills as d (d.id)}
        <li class="bg-bg-card border border-border-subtle rounded-[--radius-md] p-3 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-text-primary truncate">{d.name}</p>
            <p class="text-xs text-text-muted mt-0.5">
              {conventionName(d.conventionId)} · {systemLabel(d.systemSelectionId)} · {roleLabel(d.practiceRole)}
            </p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <a
              href="/practice/drill/{d.id}/edit"
              class="px-2.5 py-1 rounded-[--radius-md] text-xs font-medium text-text-secondary hover:text-text-primary border border-border-subtle no-underline"
            >Edit</a>
            <button
              type="button"
              onclick={() => onDelete(d.id, d.name)}
              class="px-2.5 py-1 rounded-[--radius-md] text-xs font-medium text-text-secondary hover:text-red-400 border border-border-subtle cursor-pointer"
            >Delete</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</main>
