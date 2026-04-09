<script lang="ts">
  import type { ModuleCatalogEntry, ConfigurableSurfaceView, ModuleConfigSchemaView } from "../../../service";
  import { getUserModuleStore } from "../../../stores/context";
  import { getModuleFlowTreeSync, getModuleConfigSchemaSync } from "../../../service/service-helpers";
  import type { ModuleFlowTreeViewport } from "../../../service/response-types";
  import { layoutFlowTree } from "./flow-tree-layout";
  import type { CanvasViewport } from "./flow-chart-types";
  import ModulePickerSidebar from "./ModulePickerSidebar.svelte";
  import FlowTreeNodeComponent from "./FlowTreeNodeComponent.svelte";
  import FlowTreeEdge from "./FlowTreeEdge.svelte";
  import NodeDetailPanel from "./NodeDetailPanel.svelte";

  interface Props {
    systemModules: ModuleCatalogEntry[];
    onFork: (moduleId: string) => Promise<void>;
    onNavigateToEditor: (moduleId: string) => void;
  }

  let { systemModules, onFork, onNavigateToEditor }: Props = $props();

  const userModules = getUserModuleStore();

  // State
  let selectedModuleId = $state<string | null>(null);
  let selectedNodeId = $state<string | null>(null);
  let search = $state("");
  let parameterOverrides = $state<Record<string, number | boolean>>({});

  // Viewport state for pan/zoom
  let viewport = $state<CanvasViewport>({ x: 0, y: 0, zoom: 1 });
  let isPanning = $state(false);
  let panStart = $state({ x: 0, y: 0 });

  // Derived
  const flowTree = $derived.by(() => {
    if (!selectedModuleId) return null;
    // Track parameterOverrides to re-derive after parameter changes
    void parameterOverrides;
    return getModuleFlowTreeSync(selectedModuleId) as ModuleFlowTreeViewport | null;
  });

  const layout = $derived(flowTree ? layoutFlowTree(flowTree.root) : null);

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

  const selectedNode = $derived(
    selectedNodeId && layout
      ? layout.nodes.find((n) => n.id === selectedNodeId) ?? null
      : null,
  );

  const isUserModule = $derived(selectedModuleId?.startsWith("user:") ?? false);

  const panelOpen = $derived(selectedNode !== null);

  // Canvas sizing
  const canvasWidth = $derived(layout ? Math.max(800, layout.totalWidth + 80) : 800);
  const canvasHeight = $derived(layout ? Math.max(600, layout.totalHeight + 80) : 600);

  // Auto-fit when module changes
  $effect(() => {
    if (layout) {
      // Reset viewport to fit the tree
      viewport = { x: 40, y: 40, zoom: 1 };
      selectedNodeId = null;
    }
  });

  // Pan/zoom handlers
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
    const newZoom = Math.max(0.3, Math.min(3, viewport.zoom * zoomFactor));
    viewport = { ...viewport, zoom: newZoom };
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const target = e.target as Element;
    if (target.tagName !== "svg" && !target.classList.contains("canvas-bg")) return;
    isPanning = true;
    panStart = { x: e.clientX - viewport.x, y: e.clientY - viewport.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isPanning) return;
    viewport = { ...viewport, x: e.clientX - panStart.x, y: e.clientY - panStart.y };
  }

  function handlePointerUp() {
    isPanning = false;
  }

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

  function handleForkSelected() {
    if (selectedModuleId) {
      onFork(selectedModuleId);
    }
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
    onFork={(id) => { onFork(id); }}
    onDelete={handleDeleteModule}
    {onNavigateToEditor}
    onSearchChange={(v) => { search = v; }}
  />

  <!-- Center: flow tree canvas -->
  <div class="relative overflow-hidden bg-bg-base">
    {#if layout}
      <!-- Zoom controls -->
      <div class="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <button
          class="w-8 h-8 rounded-[--radius-md] bg-bg-card border border-border-subtle text-text-muted hover:text-text-primary flex items-center justify-center cursor-pointer transition-colors text-sm font-bold"
          onclick={() => { viewport = { ...viewport, zoom: Math.min(3, viewport.zoom * 1.2) }; }}
          aria-label="Zoom in"
        >+</button>
        <button
          class="w-8 h-8 rounded-[--radius-md] bg-bg-card border border-border-subtle text-text-muted hover:text-text-primary flex items-center justify-center cursor-pointer transition-colors text-sm font-bold"
          onclick={() => { viewport = { ...viewport, zoom: Math.max(0.3, viewport.zoom / 1.2) }; }}
          aria-label="Zoom out"
        >-</button>
        <button
          class="w-8 h-8 rounded-[--radius-md] bg-bg-card border border-border-subtle text-text-muted hover:text-text-primary flex items-center justify-center cursor-pointer transition-colors text-[10px] font-medium"
          onclick={() => { viewport = { x: 40, y: 40, zoom: 1 }; }}
          aria-label="Reset zoom"
        >1:1</button>
      </div>

      <!-- Zoom indicator -->
      <div class="absolute bottom-3 left-3 z-10 text-[10px] text-text-muted bg-bg-card/80 px-2 py-0.5 rounded-[--radius-md]">
        {Math.round(viewport.zoom * 100)}%
      </div>

      <svg
        class="w-full h-full"
        viewBox="0 0 {canvasWidth} {canvasHeight}"
        onwheel={handleWheel}
        onpointerdown={handlePointerDown}
        onpointermove={handlePointerMove}
        onpointerup={handlePointerUp}
        style="cursor: {isPanning ? 'grabbing' : 'grab'};"
      >
        <rect class="canvas-bg" x="0" y="0" width={canvasWidth} height={canvasHeight} fill="transparent" />

        <g transform="translate({viewport.x},{viewport.y}) scale({viewport.zoom})">
          <!-- Grid dots -->
          {#each Array(Math.ceil(canvasWidth / 40)) as _, col (col)}
            {#each Array(Math.ceil(canvasHeight / 40)) as _, row (row)}
              <circle cx={col * 40} cy={row * 40} r="1" fill="var(--color-border-subtle)" opacity="0.3" />
            {/each}
          {/each}

          <!-- Edges (lower layer) -->
          {#each layout.edges as edge (edge.id)}
            <FlowTreeEdge
              {edge}
              highlighted={selectedNodeId === edge.sourceId || selectedNodeId === edge.targetId}
            />
          {/each}

          <!-- Nodes (upper layer) -->
          {#each layout.nodes as node (node.id)}
            <FlowTreeNodeComponent
              {node}
              selected={selectedNodeId === node.id}
              onSelect={handleNodeSelect}
            />
          {/each}
        </g>
      </svg>
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
        onFork={handleForkSelected}
      />
    {/if}
  </div>
</div>
