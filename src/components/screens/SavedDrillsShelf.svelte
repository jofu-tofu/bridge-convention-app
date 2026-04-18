<script lang="ts">
  import { listConventions, displayConventionName } from "../../service";
  import type { ConventionInfo } from "../../service";
  import { getDrillsStore } from "../../stores/context";
  import { DRILL_NAME_MAX } from "../../stores/drills.svelte";
  import type { Drill } from "../../stores/drills.svelte";
  import SectionHeader from "../shared/SectionHeader.svelte";

  interface Props {
    onLaunch: (drill: Drill) => void;
    onEdit: (drillId: string) => void;
  }
  const { onLaunch, onEdit }: Props = $props();

  const drillsStore = getDrillsStore();
  const conventions = $derived(listConventions());
  const savedDrills = $derived(drillsStore.drills.filter((drill) => drill.moduleIds.length === 1));
  let openMenuId = $state<string | null>(null);
  let renameId = $state<string | null>(null);
  let renameValue = $state("");
  let renameError = $state<string | null>(null);

  function conventionName(id: string): string {
    const c: ConventionInfo | undefined = conventions.find((x) => x.id === id);
    return c ? displayConventionName(c.name) : id;
  }

  function ago(iso: string | null): string {
    if (!iso) return "never used";
    const then = new Date(iso).getTime();
    const now = Date.now();
    const sec = Math.max(1, Math.floor((now - then) / 1000));
    if (sec < 60) return "used just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `used ${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `used ${hr}h ago`;
    const day = Math.floor(hr / 24);
    return `used ${day}d ago`;
  }

  function toggleMenu(id: string): void {
    openMenuId = openMenuId === id ? null : id;
    renameId = null;
  }

  function closeMenu(): void {
    openMenuId = null;
    renameId = null;
  }

  function startRename(drill: Drill): void {
    renameId = drill.id;
    renameValue = drill.name;
    renameError = null;
  }

  function commitRename(): void {
    if (!renameId) return;
    const err = drillsStore.validateName(renameValue);
    if (err) { renameError = err; return; }
    drillsStore.rename(renameId, renameValue);
    closeMenu();
  }

  function onDelete(id: string): void {
    drillsStore.delete(id);
    closeMenu();
  }
</script>

<svelte:window onclick={closeMenu} />

{#if savedDrills.length > 0}
  <section class="mb-4" aria-labelledby="your-drills-heading">
    <div id="your-drills-heading">
      <SectionHeader level="h2">Your Drills</SectionHeader>
    </div>
    <div class="flex gap-2 overflow-x-auto scrollbar-none pb-1 mt-2">
      {#each savedDrills as drill (drill.id)}
        <div class="relative shrink-0" onclick={(event) => event.stopPropagation()} role="presentation">
          <div class="flex items-stretch bg-bg-card border border-border-subtle rounded-[--radius-md] overflow-hidden w-56">
            <button
              type="button"
              class="flex-1 min-w-0 text-left px-3 py-2 hover:bg-accent-primary/5 cursor-pointer"
              data-testid="drill-preset-launch-{drill.id}"
              aria-label="Launch drill {drill.name}"
              onclick={() => onLaunch(drill)}
            >
              <p class="text-sm font-semibold text-text-primary truncate flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="text-accent-primary shrink-0" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                {drill.name}
              </p>
              <p class="text-xs text-text-muted truncate">{conventionName(drill.moduleIds[0] ?? "")}</p>
              <p class="text-xs text-text-muted truncate">{ago(drill.lastUsedAt)}</p>
            </button>
            <button
              type="button"
              class="px-2 border-l border-border-subtle text-text-muted hover:text-text-primary cursor-pointer min-w-[--size-touch-target]"
              aria-label="Options for {drill.name}"
              aria-haspopup="menu"
              aria-expanded={openMenuId === drill.id}
              data-testid="drill-preset-menu-{drill.id}"
              onclick={() => toggleMenu(drill.id)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </button>
          </div>

          {#if openMenuId === drill.id}
            <div
              role="menu"
              class="absolute right-0 top-full mt-1 z-10 w-48 bg-bg-card border border-border-subtle rounded-[--radius-md] shadow-lg py-1"
            >
              {#if renameId === drill.id}
                <div class="px-2 py-1 space-y-1">
                  <input
                    type="text"
                    bind:value={renameValue}
                    maxlength={DRILL_NAME_MAX}
                    aria-label="New name"
                    class="w-full px-2 py-1 rounded-[--radius-sm] bg-bg-base border border-border-subtle text-sm text-text-primary outline-none"
                    onkeydown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") closeMenu(); }}
                  />
                  {#if renameError}<p class="text-xs text-red-400">{renameError}</p>{/if}
                  <div class="flex justify-end gap-1">
                    <button type="button" class="text-xs px-2 py-1 text-text-secondary cursor-pointer" onclick={closeMenu}>Cancel</button>
                    <button type="button" class="text-xs px-2 py-1 text-accent-primary cursor-pointer" onclick={commitRename}>Save</button>
                  </div>
                </div>
              {:else}
                <button type="button" role="menuitem" class="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-accent-primary/10 cursor-pointer" onclick={() => { onLaunch(drill); closeMenu(); }}>Launch</button>
                <button type="button" role="menuitem" class="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-accent-primary/10 cursor-pointer" onclick={() => startRename(drill)}>Rename</button>
                <button type="button" role="menuitem" class="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-accent-primary/10 cursor-pointer" onclick={() => { onEdit(drill.id); closeMenu(); }}>Edit configuration</button>
                <button type="button" role="menuitem" class="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-red-400/10 cursor-pointer" onclick={() => onDelete(drill.id)}>Delete</button>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
  .scrollbar-none {
    scrollbar-width: none;
  }
  .scrollbar-none::-webkit-scrollbar {
    display: none;
  }
</style>
