<script lang="ts">
  import type { ConfigurableSurfaceView, ModuleConfigSchemaView } from "../../service";
  import { getAppStore, getUserModuleStore } from "../../stores/context";
  import { getModuleConfigSchemaSync } from "../../service/service-helpers";
  import ParameterPanel from "./ParameterPanel.svelte";

  const appStore = getAppStore();
  const userModules = getUserModuleStore();

  const moduleId = appStore.editingModuleId;

  // Load user module data
  const userModule = $derived(moduleId ? userModules.getModule(moduleId) : undefined);

  // Local editable state — initialized from store
  let editName = $state("");
  let parameterOverrides = $state<Record<string, number | boolean>>({});
  let nameError = $state<string | null>(null);
  let initialized = $state(false);

  // Initialize from user module when it loads
  $effect(() => {
    if (userModule && !initialized) {
      editName = userModule.metadata.displayName;
      initialized = true;
    }
  });

  // Derive config schema for parameter editing
  const configSurfaces = $derived.by((): ConfigurableSurfaceView[] => {
    if (!moduleId) return [];
    try {
      let userModulesJson: string | null = null;
      if (moduleId.startsWith("user:")) {
        const um = userModules.getModule(moduleId);
        if (um) userModulesJson = JSON.stringify([um.content]);
      }
      const schema = getModuleConfigSchemaSync(moduleId, userModulesJson) as ModuleConfigSchemaView | null;
      if (schema?.surfaces) {
        return schema.surfaces.map((s: ConfigurableSurfaceView) => ({
          ...s,
          parameters: [...s.parameters],
        }));
      }
    } catch {
      // Config schema unavailable
    }
    return [];
  });

  /** Build effective surfaces with local overrides applied. */
  const effectiveSurfaces = $derived.by((): ConfigurableSurfaceView[] => {
    return configSurfaces.map(s => ({
      ...s,
      parameters: s.parameters.map(p => {
        const key = `${s.meaningId}:${p.clauseIndex}`;
        const override = parameterOverrides[key];
        return override !== undefined ? { ...p, currentValue: override } : p;
      }),
    }));
  });

  function handleParameterChange(meaningId: string, clauseIndex: number, newValue: number | boolean): void {
    if (!moduleId) return;
    const um = userModules.getModule(moduleId);
    if (!um) return;

    // Update localStorage content
    const content = JSON.parse(JSON.stringify(um.content)) as Record<string, unknown>;
    const states = content.states as Array<Record<string, unknown>> | undefined;
    if (states) {
      for (const state of states) {
        const surfaces = state.surfaces as Array<Record<string, unknown>> | undefined;
        if (!surfaces) continue;
        for (const surface of surfaces) {
          if ((surface.meaningId as string) !== meaningId) continue;
          const clauses = surface.clauses as Array<Record<string, unknown>> | undefined;
          if (!clauses || clauseIndex >= clauses.length) continue;
          const clause = clauses[clauseIndex] as Record<string, unknown> | undefined;
          if (!clause) continue;
          clause.value = newValue;
        }
      }
    }

    userModules.saveModule({
      metadata: { ...um.metadata, updatedAt: new Date().toISOString() },
      content,
    });

    parameterOverrides = {
      ...parameterOverrides,
      [`${meaningId}:${clauseIndex}`]: newValue,
    };
  }

  function handleSave(): void {
    if (!moduleId || !userModule) return;

    const trimmed = editName.trim();
    if (!trimmed) {
      nameError = "Name is required";
      return;
    }

    // Update display name if changed
    if (trimmed !== userModule.metadata.displayName) {
      userModules.saveModule({
        ...userModule,
        metadata: {
          ...userModule.metadata,
          displayName: trimmed,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    appStore.navigateToWorkshop();
  }

  function handleCancel(): void {
    appStore.navigateToWorkshop();
  }

  function handleDelete(): void {
    if (!moduleId) return;
    userModules.deleteModule(moduleId);
    appStore.navigateToWorkshop();
  }
</script>

<main class="max-w-3xl mx-auto h-full flex flex-col p-6 pb-0" aria-label="Convention Editor">
  <div class="shrink-0">
    <!-- Back button -->
    <button
      class="text-sm text-text-muted hover:text-text-primary transition-colors cursor-pointer mb-4 flex items-center gap-1"
      onclick={handleCancel}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
      Back to Workshop
    </button>

    <!-- Header with name + actions -->
    <div class="flex items-start gap-3 mb-6">
      <div class="flex-1">
        <label for="convention-name" class="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1 block">Convention Name</label>
        <input
          id="convention-name"
          type="text"
          bind:value={editName}
          oninput={() => { nameError = null; }}
          class="w-full px-3 py-2 text-lg font-semibold bg-bg-card border rounded-[--radius-md] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary
            {nameError ? 'border-red-400' : 'border-border-subtle'}"
          placeholder="Convention name"
        />
        {#if nameError}
          <p class="text-xs text-red-400 mt-1">{nameError}</p>
        {/if}
        {#if userModule?.metadata.forkedFrom}
          <p class="text-xs text-text-muted mt-2">Based on: {userModule.metadata.forkedFrom.moduleId}</p>
        {/if}
      </div>
      <div class="flex gap-2 pt-6">
        <button
          class="px-4 py-2 rounded-[--radius-md] text-sm font-medium bg-accent-primary text-text-on-accent hover:bg-accent-primary/90 transition-colors cursor-pointer"
          onclick={handleSave}
        >
          Save
        </button>
        <button
          class="px-4 py-2 rounded-[--radius-md] text-sm font-medium text-text-muted hover:text-text-primary border border-border-subtle hover:border-border-prominent transition-colors cursor-pointer"
          onclick={handleCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>

  <div class="flex-1 overflow-y-auto pb-6 space-y-6">
    {#if !userModule}
      <div class="flex items-center justify-center h-32 text-text-muted">
        <p>Convention not found</p>
      </div>
    {:else}
      <!-- Parameters -->
      {#if effectiveSurfaces.length > 0}
        <section>
          <h2 class="text-sm font-semibold text-text-primary mb-3">Parameters</h2>
          <ParameterPanel surfaces={effectiveSurfaces} onParameterChange={handleParameterChange} />
        </section>
      {:else}
        <section>
          <div class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-4">
            <p class="text-sm text-text-muted">This convention has no configurable parameters.</p>
          </div>
        </section>
      {/if}

      <!-- Delete -->
      <section class="pt-4 border-t border-border-subtle">
        <button
          class="px-4 py-2 rounded-[--radius-md] text-sm font-medium text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400/50 transition-colors cursor-pointer"
          onclick={handleDelete}
        >
          Delete Convention
        </button>
      </section>
    {/if}
  </div>
</main>
