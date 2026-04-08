<script lang="ts">
  import type { ModuleFlowTreeViewport, ModuleLearningViewport, ModuleCategory, ModuleConfigSchemaView, ConfigurableSurfaceView } from "../../service";
  import type { UserModule } from "../../service/session-types";
  import { getService, getUserModuleStore, getAppStore } from "../../stores/context";
  import { getModuleLearningViewportSync, getModuleFlowTreeSync, getModuleConfigSchemaSync } from "../../service/service-helpers";
  import ConversationFlowTree from "./ConversationFlowTree.svelte";
  import ParameterPanel from "./ParameterPanel.svelte";

  interface Props {
    moduleId: string;
    onFork?: (newModuleId: string) => void;
    onDelete?: () => void;
    isUserModule?: boolean;
  }

  let { moduleId, onFork, onDelete, isUserModule = false }: Props = $props();

  const service = getService();
  const userModules = getUserModuleStore();
  const appStore = getAppStore();

  let forking = $state(false);

  async function handleFork() {
    if (forking) return;
    forking = true;
    try {
      const content = await service.forkModule(moduleId);
      const contentObj = content as Record<string, unknown>;
      const forkedModuleId = contentObj.moduleId as string;
      const now = new Date().toISOString();
      const userModule: UserModule = {
        metadata: {
          moduleId: forkedModuleId,
          displayName: contentObj.displayName as string,
          category: (contentObj.category as ModuleCategory) ?? "custom",
          forkedFrom: {
            moduleId: moduleId,
            fixtureVersion: (contentObj.fixtureVersion as number) ?? 1,
          },
          createdAt: now,
          updatedAt: now,
        },
        content,
      };
      userModules.saveModule(userModule);
      onFork?.(forkedModuleId);
      appStore.navigateToConventionEditor(forkedModuleId);
    } finally {
      forking = false;
    }
  }

  // Track parameter edits locally — overrides from configSurfaces
  let parameterOverrides = $state<Record<string, number | boolean>>({});

  /** Build the effective surfaces list with any local overrides applied. */
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

  /** Apply a parameter change to the user module content in localStorage. */
  function handleParameterChange(meaningId: string, clauseIndex: number, newValue: number | boolean): void {
    if (!isUserModule) return;

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

    // Apply override locally for immediate UI update
    parameterOverrides = {
      ...parameterOverrides,
      [`${meaningId}:${clauseIndex}`]: newValue,
    };
  }

  /** Delete the current user module. */
  function handleDelete(): void {
    if (!isUserModule) return;
    userModules.deleteModule(moduleId);
    onDelete?.();
  }

  // Derive viewport data from moduleId — sync for system modules, localStorage for user
  const moduleData = $derived.by(() => {
    const id = moduleId;
    if (id.startsWith("user:")) {
      const um = userModules.getModule(id);
      if (!um) return null;
      const content = um.content as Record<string, unknown>;
      return {
        viewport: {
          moduleId: um.metadata.moduleId,
          displayName: um.metadata.displayName,
          description: (content.description as string) ?? "",
          purpose: (content.purpose as string) ?? "",
          teaching: {
            principle: ((content.teaching as Record<string, unknown>)?.principle as string) ?? "",
            tradeoff: ((content.teaching as Record<string, unknown>)?.tradeoff as string) ?? "",
            commonMistakes: ((content.teaching as Record<string, unknown>)?.commonMistakes as string[]) ?? [],
          },
          phases: [],
          bundleIds: [],
        } as ModuleLearningViewport,
        flowTree: null as ModuleFlowTreeViewport | null,
      };
    }
    // System modules: use sync WASM helpers
    const vp = getModuleLearningViewportSync(id) as ModuleLearningViewport | null;
    const tree = getModuleFlowTreeSync(id) as ModuleFlowTreeViewport | null;
    return vp ? { viewport: vp, flowTree: tree } : null;
  });

  // Derive config schema synchronously alongside viewport data
  const configSurfaces = $derived.by((): ConfigurableSurfaceView[] => {
    const id = moduleId;
    try {
      let userModulesJson: string | null = null;
      if (id.startsWith("user:")) {
        const um = userModules.getModule(id);
        if (um) userModulesJson = JSON.stringify([um.content]);
      }
      const schema = getModuleConfigSchemaSync(id, userModulesJson) as ModuleConfigSchemaView | null;
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
</script>

{#if moduleData}
  {@const vp = moduleData.viewport}
  {@const ft = moduleData.flowTree}
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-xl font-bold text-text-primary">
            {vp.displayName}
            {#if isUserModule}
              <span class="ml-2 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-accent-primary/15 text-accent-primary align-middle">yours</span>
            {/if}
          </h2>
          <p class="text-sm text-text-secondary mt-1">{vp.description}</p>
          {#if vp.purpose}
            <p class="text-xs text-text-muted mt-2 italic">{vp.purpose}</p>
          {/if}
        </div>
        <div class="flex gap-2 shrink-0">
          {#if !isUserModule}
            <button
              class="px-3 py-1.5 rounded-[--radius-md] text-xs font-medium bg-accent-primary text-text-on-accent hover:bg-accent-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              onclick={handleFork}
              disabled={forking}
            >
              {forking ? "Creating..." : "Customize"}
            </button>
          {:else}
            <button
              class="px-3 py-1.5 rounded-[--radius-md] text-xs font-medium text-text-muted hover:text-text-primary border border-border-subtle hover:border-border-prominent transition-colors cursor-pointer"
              onclick={() => appStore.navigateToConventionEditor(moduleId)}
            >
              Edit
            </button>
            <button
              class="px-3 py-1.5 rounded-[--radius-md] text-xs font-medium text-red-400 hover:text-red-300 border border-border-subtle hover:border-red-400/50 transition-colors cursor-pointer"
              onclick={handleDelete}
            >
              Delete
            </button>
          {/if}
        </div>
      </div>
    </div>

    <!-- Teaching -->
    {#if vp.teaching.principle || vp.teaching.tradeoff || vp.teaching.commonMistakes.length > 0}
      <div class="space-y-3">
        {#if vp.teaching.principle}
          <div class="bg-bg-card rounded-[--radius-lg] border border-border-subtle p-4">
            <h3 class="text-xs font-semibold text-accent-primary mb-1">Principle</h3>
            <p class="text-sm text-text-primary leading-relaxed">{vp.teaching.principle}</p>
          </div>
        {/if}
        {#if vp.teaching.tradeoff}
          <div class="bg-bg-card rounded-[--radius-lg] border border-border-subtle p-4">
            <h3 class="text-xs font-semibold text-text-secondary mb-1">Tradeoff</h3>
            <p class="text-sm text-text-primary leading-relaxed">{vp.teaching.tradeoff}</p>
          </div>
        {/if}
        {#if vp.teaching.commonMistakes.length > 0}
          <div class="bg-bg-card rounded-[--radius-lg] border border-border-subtle p-4">
            <h3 class="text-xs font-semibold text-accent-danger mb-1">Common Mistakes</h3>
            <ul class="space-y-1.5">
              {#each vp.teaching.commonMistakes as mistake, i (i)}
                <li class="text-sm text-text-primary leading-relaxed flex gap-2">
                  <span class="shrink-0 text-text-muted">-</span>
                  <span>{mistake}</span>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Configurable Parameters (editable for user modules, read-only view for system) -->
    {#if effectiveSurfaces.length > 0}
      <div>
        <h3 class="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
          {isUserModule ? "Adjust Thresholds" : "Thresholds"}
        </h3>
        {#if isUserModule}
          <ParameterPanel surfaces={effectiveSurfaces} onParameterChange={handleParameterChange} />
        {:else}
          <ParameterPanel surfaces={effectiveSurfaces} onParameterChange={() => {}} />
          <p class="text-xs text-text-muted mt-2 italic">Click "Customize" to create your own version with adjustable thresholds.</p>
        {/if}
      </div>
    {/if}

    <!-- Flow Tree -->
    {#if ft}
      <div>
        <h3 class="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Conversation Flow</h3>
        <div class="overflow-x-auto bg-bg-card rounded-[--radius-lg] border border-border-subtle">
          <ConversationFlowTree tree={ft} />
        </div>
      </div>
    {/if}
  </div>
{:else}
  <div class="text-text-muted text-sm">Module not found</div>
{/if}
