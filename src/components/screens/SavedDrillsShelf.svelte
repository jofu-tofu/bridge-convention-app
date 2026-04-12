<script lang="ts">
  import { listConventions, displayConventionName } from "../../service";
  import type { ConventionInfo } from "../../service";
  import { getDrillPresetsStore } from "../../stores/context";
  import type { DrillPreset } from "../../stores/drill-presets.svelte";
  import SectionHeader from "../shared/SectionHeader.svelte";

  interface Props {
    onLaunch: (preset: DrillPreset) => void;
    onEdit: (presetId: string) => void;
  }
  const { onLaunch, onEdit }: Props = $props();

  const presetsStore = getDrillPresetsStore();
  const conventions = $derived(listConventions());
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

  function startRename(p: DrillPreset): void {
    renameId = p.id;
    renameValue = p.name;
    renameError = null;
  }

  function commitRename(): void {
    if (!renameId) return;
    const err = presetsStore.validateName(renameValue);
    if (err) { renameError = err; return; }
    presetsStore.update(renameId, { name: renameValue });
    closeMenu();
  }

  function onDelete(id: string): void {
    presetsStore.delete(id);
    closeMenu();
  }
</script>

<svelte:window onclick={closeMenu} />

{#if presetsStore.presets.length > 0}
  <section class="mb-4" aria-labelledby="your-drills-heading">
    <div id="your-drills-heading">
      <SectionHeader level="h2">Your Drills</SectionHeader>
    </div>
    <div class="flex gap-2 overflow-x-auto scrollbar-none pb-1 mt-2">
      {#each presetsStore.presets as preset (preset.id)}
        <div class="relative shrink-0" onclick={(e) => e.stopPropagation()} role="presentation">
          <div class="flex items-stretch bg-bg-card border border-border-subtle rounded-[--radius-md] overflow-hidden w-56">
            <button
              type="button"
              class="flex-1 min-w-0 text-left px-3 py-2 hover:bg-accent-primary/5 cursor-pointer"
              data-testid="drill-preset-launch-{preset.id}"
              aria-label="Launch drill {preset.name}"
              onclick={() => onLaunch(preset)}
            >
              <p class="text-sm font-semibold text-text-primary truncate flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="text-accent-primary shrink-0" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                {preset.name}
              </p>
              <p class="text-xs text-text-muted truncate">{conventionName(preset.conventionId)}</p>
              <p class="text-xs text-text-muted truncate">{ago(preset.lastUsedAt)}</p>
            </button>
            <button
              type="button"
              class="px-2 border-l border-border-subtle text-text-muted hover:text-text-primary cursor-pointer min-w-[--size-touch-target]"
              aria-label="Options for {preset.name}"
              aria-haspopup="menu"
              aria-expanded={openMenuId === preset.id}
              data-testid="drill-preset-menu-{preset.id}"
              onclick={() => toggleMenu(preset.id)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </button>
          </div>

          {#if openMenuId === preset.id}
            <div
              role="menu"
              class="absolute right-0 top-full mt-1 z-10 w-48 bg-bg-card border border-border-subtle rounded-[--radius-md] shadow-lg py-1"
            >
              {#if renameId === preset.id}
                <div class="px-2 py-1 space-y-1">
                  <input
                    type="text"
                    bind:value={renameValue}
                    maxlength={60}
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
                <button type="button" role="menuitem" class="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-accent-primary/10 cursor-pointer" onclick={() => { onLaunch(preset); closeMenu(); }}>Launch</button>
                <button type="button" role="menuitem" class="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-accent-primary/10 cursor-pointer" onclick={() => startRename(preset)}>Rename</button>
                <button type="button" role="menuitem" class="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-accent-primary/10 cursor-pointer" onclick={() => { onEdit(preset.id); closeMenu(); }}>Edit configuration</button>
                <button type="button" role="menuitem" class="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-red-400/10 cursor-pointer" onclick={() => onDelete(preset.id)}>Delete</button>
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
