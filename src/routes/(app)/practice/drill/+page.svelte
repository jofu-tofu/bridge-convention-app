<script lang="ts">
  import { AVAILABLE_BASE_SYSTEMS, PracticeRole, displayConventionName, listConventions } from "../../../../service";
  import type { SystemSelectionId } from "../../../../service";
  import { getDrillsStore, getCustomSystemsStore } from "../../../../stores/context";
  import AppScreen from "../../../../components/shared/AppScreen.svelte";

  const drillsStore = getDrillsStore();
  const customSystems = getCustomSystemsStore();
  const allConventions = listConventions();
  const drills = $derived(drillsStore.drills.filter((drill) => drill.moduleIds.length === 1));

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

  function roleLabel(r: PracticeRole | "auto"): string {
    if (r === "auto") return "Auto";
    if (r === PracticeRole.Opener) return "Opener";
    if (r === PracticeRole.Responder) return "Responder";
    return "Both";
  }

  function onDelete(id: string, name: string): void {
    if (confirm(`Delete "${name}"?`)) drillsStore.delete(id);
  }
</script>

<AppScreen
  title="My drills"
  subtitle="Drills you've configured. Launching lands in a later update."
  width="custom"
>
  {#snippet actions()}
    <a
      href="/practice/drill/new"
      class="px-3 py-1.5 rounded-[--radius-md] text-sm font-medium bg-accent-primary text-text-on-accent hover:bg-accent-primary-hover no-underline"
    >New drill</a>
  {/snippet}

  {#if drills.length === 0}
    <div class="text-center py-16 border border-dashed border-border-subtle rounded-[--radius-lg]">
      <p class="text-text-muted mb-4">No custom drills yet.</p>
      <a
        href="/practice/drill/new"
        class="inline-block px-3 py-1.5 rounded-[--radius-md] text-sm font-medium border border-border-subtle text-text-primary hover:border-border-prominent no-underline"
      >Create your first drill</a>
    </div>
  {:else}
    <ul class="space-y-2">
      {#each drills as d (d.id)}
        <li class="relative group bg-bg-card border border-border-subtle rounded-[--radius-md] transition-all hover:border-border-default hover:shadow-md focus-within:border-accent-primary">
          <a
            href="/practice/drill/{d.id}/edit"
            class="block p-3 pr-24 no-underline focus-visible:outline-none"
          >
            <p class="text-sm font-medium text-text-primary truncate group-hover:text-accent-primary transition-colors">{d.name}</p>
            <p class="text-xs text-text-muted mt-0.5">
              {conventionName(d.moduleIds[0] ?? "")} · {systemLabel(d.systemSelectionId)} · {roleLabel(d.practiceRole)}
            </p>
          </a>
          <button
            type="button"
            onclick={() => onDelete(d.id, d.name)}
            class="absolute top-1/2 -translate-y-1/2 right-2 px-2.5 py-1 rounded-[--radius-md] text-xs font-medium text-text-secondary hover:text-red-400 hover:border-border-default border border-border-subtle bg-bg-card cursor-pointer transition-colors"
            aria-label="Delete drill {d.name}"
          >Delete</button>
        </li>
      {/each}
    </ul>
  {/if}
</AppScreen>
