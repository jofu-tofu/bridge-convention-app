<script lang="ts">
  import type { ModuleCatalogEntry } from "../../service";
  import { listModules } from "../../service";
  import { getUserModuleStore } from "../../stores/context";
  import ModuleSidebar from "./ModuleSidebar.svelte";
  import ModuleViewer from "./ModuleViewer.svelte";

  const systemModules: ModuleCatalogEntry[] = listModules();
  const userModules = getUserModuleStore();

  let selectedModuleId = $state<string | null>(null);

  const isSelectedUserModule = $derived(
    selectedModuleId ? userModules.hasModule(selectedModuleId) : false,
  );

  function handleFork(newModuleId: string) {
    selectedModuleId = newModuleId;
  }

  function handleDelete() {
    selectedModuleId = null;
  }
</script>

<div class="flex h-full gap-4">
  <!-- Sidebar -->
  <div class="w-64 shrink-0 overflow-y-auto">
    <ModuleSidebar
      modules={systemModules}
      selectedId={selectedModuleId}
      onSelect={(id) => { selectedModuleId = id; }}
    />
  </div>

  <!-- Main content -->
  <div class="flex-1 overflow-y-auto">
    {#if selectedModuleId}
      <ModuleViewer
        moduleId={selectedModuleId}
        onFork={handleFork}
        onDelete={handleDelete}
        isUserModule={isSelectedUserModule}
      />
    {:else}
      <div class="flex items-center justify-center h-full text-text-muted">
        <p>Select a convention to view its details</p>
      </div>
    {/if}
  </div>
</div>
