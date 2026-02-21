<script lang="ts">
  import { listConventions } from "../conventions/registry";
  import { getAppStore } from "../lib/context";
  import type { ConventionConfig } from "../conventions/types";

  const appStore = getAppStore();
  const conventions = listConventions();

  function handleSelect(config: ConventionConfig) {
    appStore.selectConvention(config);
  }
</script>

<div class="max-w-2xl mx-auto p-6">
  <h1 class="text-3xl font-bold text-gray-100 mb-2">Bridge Practice</h1>
  <p class="text-gray-400 mb-8">Select a convention to begin drilling.</p>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {#each conventions as convention (convention.id)}
      <button
        class="text-left p-4 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 transition-colors cursor-pointer"
        onclick={() => handleSelect(convention)}
      >
        <h2 class="text-lg font-semibold text-gray-200">{convention.name}</h2>
        <p class="text-sm text-gray-400 mt-1">{convention.description}</p>
        <span class="inline-block mt-2 px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
          {convention.category}
        </span>
      </button>
    {/each}
  </div>
</div>
