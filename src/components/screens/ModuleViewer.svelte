<script lang="ts">
  import type { ModuleFlowTreeViewport, ModuleLearningViewport, ModuleCategory, ModuleConfigSchemaView, ConfigurableSurfaceView } from "../../service";
  import type { UserModule } from "../../service/session-types";
  import { getService, getUserModuleStore } from "../../stores/context";
  import { getModuleLearningViewportSync, getModuleFlowTreeSync } from "../../service/service-helpers";
  import ConversationFlowTree from "./ConversationFlowTree.svelte";
  import ParameterPanel from "./ParameterPanel.svelte";

  interface Props {
    moduleId: string;
    onFork?: (newModuleId: string) => void;
    isUserModule?: boolean;
  }

  let { moduleId, onFork, isUserModule = false }: Props = $props();

  const service = getService();
  const userModules = getUserModuleStore();

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
    } finally {
      forking = false;
    }
  }

  let flowTree = $state<ModuleFlowTreeViewport | null>(null);
  let viewport = $state<ModuleLearningViewport | null>(null);
  let _configSchema = $state<ModuleConfigSchemaView | null>(null);
  let editableSurfaces = $state<ConfigurableSurfaceView[]>([]);

  /** Load config schema for a module (works for both system and user modules). */
  async function loadConfigSchema(id: string): Promise<void> {
    try {
      let userModulesJson: string | undefined;
      if (id.startsWith("user:")) {
        const um = userModules.getModule(id);
        if (um) {
          userModulesJson = JSON.stringify([um.content]);
        }
      }
      const schema = await service.getModuleConfigSchema(id, userModulesJson);
      _configSchema = schema;
      editableSurfaces = schema.surfaces.map(s => ({
        ...s,
        parameters: s.parameters.map(p => ({ ...p })),
      }));
    } catch {
      _configSchema = null;
      editableSurfaces = [];
    }
  }

  /** Apply a parameter change to the user module content in localStorage. */
  function handleParameterChange(meaningId: string, clauseIndex: number, newValue: number | boolean): void {
    if (!isUserModule) return;

    const um = userModules.getModule(moduleId);
    if (!um) return;

    const content = JSON.parse(JSON.stringify(um.content)) as Record<string, unknown>;
    const states = content.states as Array<Record<string, unknown>> | undefined;
    if (!states) return;

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

    const updated: UserModule = {
      metadata: { ...um.metadata, updatedAt: new Date().toISOString() },
      content,
    };
    userModules.saveModule(updated);

    editableSurfaces = editableSurfaces.map(s => {
      if (s.meaningId !== meaningId) return s;
      return {
        ...s,
        parameters: s.parameters.map(p =>
          p.clauseIndex !== clauseIndex ? p : { ...p, currentValue: newValue },
        ),
      };
    });
  }

  $effect(() => {
    const id = moduleId;
    flowTree = null;
    viewport = null;
    _configSchema = null;
    editableSurfaces = [];

    if (id.startsWith("user:")) {
      // User modules: load from localStorage
      const um = userModules.getModule(id);
      if (um) {
        const content = um.content as Record<string, unknown>;
        viewport = {
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
        };
      }
      void loadConfigSchema(id);
    } else {
      // System modules: use sync WASM helpers (same pattern as listModules/listConventions)
      viewport = getModuleLearningViewportSync(id) as ModuleLearningViewport | null;
      flowTree = getModuleFlowTreeSync(id) as ModuleFlowTreeViewport | null;
      void loadConfigSchema(id);
    }
  });
</script>

{#if viewport}
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-xl font-bold text-text-primary">
            {viewport.displayName}
            {#if isUserModule}
              <span class="ml-2 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-accent-primary/15 text-accent-primary align-middle">custom</span>
            {/if}
          </h2>
          <p class="text-sm text-text-secondary mt-1">{viewport.description}</p>
          {#if viewport.purpose}
            <p class="text-xs text-text-muted mt-2 italic">{viewport.purpose}</p>
          {/if}
        </div>
        {#if !isUserModule}
          <button
            class="shrink-0 px-3 py-1.5 rounded-[--radius-md] text-xs font-medium text-text-muted hover:text-text-primary border border-border-subtle hover:border-accent-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onclick={handleFork}
            disabled={forking}
          >
            {forking ? "Forking..." : "Fork to customize"}
          </button>
        {/if}
      </div>
    </div>

    <!-- Teaching -->
    {#if viewport.teaching.principle || viewport.teaching.tradeoff || viewport.teaching.commonMistakes.length > 0}
      <div class="space-y-3">
        {#if viewport.teaching.principle}
          <div class="bg-bg-card rounded-[--radius-lg] border border-border-subtle p-4">
            <h3 class="text-xs font-semibold text-accent-primary mb-1">Principle</h3>
            <p class="text-sm text-text-primary leading-relaxed">{viewport.teaching.principle}</p>
          </div>
        {/if}
        {#if viewport.teaching.tradeoff}
          <div class="bg-bg-card rounded-[--radius-lg] border border-border-subtle p-4">
            <h3 class="text-xs font-semibold text-text-secondary mb-1">Tradeoff</h3>
            <p class="text-sm text-text-primary leading-relaxed">{viewport.teaching.tradeoff}</p>
          </div>
        {/if}
        {#if viewport.teaching.commonMistakes.length > 0}
          <div class="bg-bg-card rounded-[--radius-lg] border border-border-subtle p-4">
            <h3 class="text-xs font-semibold text-accent-danger mb-1">Common Mistakes</h3>
            <ul class="space-y-1.5">
              {#each viewport.teaching.commonMistakes as mistake, i (i)}
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
    {#if editableSurfaces.length > 0}
      <div>
        <h3 class="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
          {isUserModule ? "Configure Parameters" : "Parameters"}
        </h3>
        {#if isUserModule}
          <ParameterPanel surfaces={editableSurfaces} onParameterChange={handleParameterChange} />
        {:else}
          <ParameterPanel surfaces={editableSurfaces} onParameterChange={() => {}} />
          <p class="text-xs text-text-muted mt-2 italic">Fork this module to edit parameters.</p>
        {/if}
      </div>
    {/if}

    <!-- Flow Tree -->
    {#if flowTree}
      <div>
        <h3 class="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Conversation Flow</h3>
        <div class="overflow-x-auto bg-bg-card rounded-[--radius-lg] border border-border-subtle">
          <ConversationFlowTree tree={flowTree} />
        </div>
      </div>
    {/if}
  </div>
{:else}
  <div class="text-text-muted text-sm">Module not found</div>
{/if}
