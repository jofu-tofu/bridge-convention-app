<script lang="ts">
  import type { ModuleCatalogEntry, ConfigurableSurfaceView, ModuleConfigSchemaView, FlowTreeNode } from "../../../service";
  import { getUserModuleStore } from "../../../stores/context";
  import { getModuleFlowTreeSync, getModuleConfigSchemaSync } from "../../../service/service-helpers";
  import type { ModuleFlowTreeViewport } from "../../../service/response-types";
  import ModulePickerSidebar from "./ModulePickerSidebar.svelte";
  import NodeDetailPanel from "./NodeDetailPanel.svelte";
  import ConversationFlowTree from "../ConversationFlowTree.svelte";

  // Fork entry point moved to CreationPickerDialog (Workshop "New Convention" button)

  interface Props {
    systemModules: ModuleCatalogEntry[];
    onNavigateToEditor: (moduleId: string) => void;
  }

  let { systemModules, onNavigateToEditor }: Props = $props();

  const userModules = getUserModuleStore();

  // State
  let selectedModuleId = $state<string | null>(null);
  let selectedNodeId = $state<string | null>(null);
  let search = $state("");
  let parameterOverrides = $state<Record<string, number | boolean>>({});

  // Derived
  const flowTree = $derived.by(() => {
    if (!selectedModuleId) return null;
    // Track parameterOverrides to re-derive after parameter changes
    void parameterOverrides;
    return getModuleFlowTreeSync(selectedModuleId) as ModuleFlowTreeViewport | null;
  });

  const configSchema = $derived.by(() => {
    if (!selectedModuleId) return null;
    const userModulesJson = userModules.listModules().length > 0
      ? JSON.stringify(userModules.listModules().map((um) => um.content))
      : null;
    return getModuleConfigSchemaSync(selectedModuleId, userModulesJson) as ModuleConfigSchemaView | null;
  });

  const configSurfaces = $derived<readonly ConfigurableSurfaceView[]>(
    configSchema?.surfaces ?? [],
  );

  function findNode(node: FlowTreeNode, id: string): FlowTreeNode | null {
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  }

  const selectedNode = $derived(
    selectedNodeId && flowTree ? findNode(flowTree.root, selectedNodeId) : null,
  );

  const isUserModule = $derived(selectedModuleId?.startsWith("user:") ?? false);

  const panelOpen = $derived(selectedNode !== null);

  // Reset selection when module changes
  $effect(() => {
    void flowTree;
    selectedNodeId = null;
  });

  function handleNodeSelect(nodeId: string) {
    selectedNodeId = selectedNodeId === nodeId ? null : nodeId;
  }

  function handleParameterChange(meaningId: string, clauseIndex: number, newValue: number | boolean): void {
    if (!selectedModuleId || !selectedModuleId.startsWith("user:")) return;
    const um = userModules.getModule(selectedModuleId);
    if (!um) return;
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
          clauses[clauseIndex]!.value = newValue;
        }
      }
    }
    userModules.saveModule({
      metadata: { ...um.metadata, updatedAt: new Date().toISOString() },
      content,
    });
    parameterOverrides = { ...parameterOverrides, [`${meaningId}:${clauseIndex}`]: newValue };
  }

  function handleDeleteModule(moduleId: string) {
    userModules.deleteModule(moduleId);
    if (selectedModuleId === moduleId) {
      selectedModuleId = null;
      selectedNodeId = null;
    }
  }
</script>

<div
  class="h-full grid transition-[grid-template-columns] duration-200"
  style="grid-template-columns: 240px 1fr {panelOpen ? '360px' : '0px'};"
>
  <!-- Left sidebar: module picker -->
  <ModulePickerSidebar
    {systemModules}
    {selectedModuleId}
    {search}
    onSelectModule={(id) => { selectedModuleId = id; }}
    onDelete={handleDeleteModule}
    {onNavigateToEditor}
    onSearchChange={(v) => { search = v; }}
  />

  <!-- Center: flow tree -->
  <div class="relative overflow-auto bg-bg-base">
    {#if flowTree}
      <ConversationFlowTree
        tree={flowTree}
        {selectedNodeId}
        onNodeSelect={handleNodeSelect}
      />
    {:else}
      <!-- Empty state -->
      <div class="flex items-center justify-center h-full">
        <div class="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="text-border-subtle mx-auto mb-3" aria-hidden="true">
            <path d="M12 3v18"/><path d="M8 7l4-4 4 4"/><path d="M4 15h16"/><path d="M8 19h8"/>
          </svg>
          <p class="text-sm text-text-muted">Select a module to view its flow tree</p>
        </div>
      </div>
    {/if}
  </div>

  <!-- Right panel: node detail -->
  <div class="overflow-hidden {panelOpen ? '' : 'w-0'}">
    {#if selectedNode}
      <NodeDetailPanel
        node={selectedNode}
        surfaces={configSurfaces}
        {isUserModule}
        onParameterChange={handleParameterChange}
        onClose={() => { selectedNodeId = null; }}
      />
    {/if}
  </div>
</div>
