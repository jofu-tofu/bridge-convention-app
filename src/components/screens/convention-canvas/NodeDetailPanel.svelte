<script lang="ts">
  import type { ConfigurableSurfaceView } from "../../../service/response-types";
  import ParameterPanel from "../ParameterPanel.svelte";
  import type { FlowChartNode } from "./flow-chart-types";

  interface Props {
    node: FlowChartNode;
    surfaces: readonly ConfigurableSurfaceView[];
    isUserModule: boolean;
    onParameterChange: (meaningId: string, clauseIndex: number, newValue: number | boolean) => void;
    onClose: () => void;
    onFork: () => void;
  }

  let { node, surfaces, isUserModule, onParameterChange, onClose, onFork }: Props = $props();

  const matchedSurfaces = $derived(
    node.flowNode.meaningId
      ? surfaces.filter((s) => s.meaningId === node.flowNode.meaningId)
      : [],
  );

  const suitColors: Record<string, string> = {
    "\u2660": "var(--color-suit-spade)",
    "\u2665": "var(--color-suit-heart)",
    "\u2666": "var(--color-suit-diamond)",
    "\u2663": "var(--color-suit-club)",
  };

  function getCallColor(callDisplay: string | null): string {
    if (!callDisplay) return "var(--color-text-primary)";
    for (const [suit, color] of Object.entries(suitColors)) {
      if (callDisplay.includes(suit)) return color;
    }
    return "var(--color-text-primary)";
  }
</script>

<aside class="h-full border-l border-border-subtle bg-bg-base flex flex-col overflow-hidden">
  <!-- Header -->
  <div class="shrink-0 p-4 border-b border-border-subtle">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2 min-w-0">
        {#if node.flowNode.callDisplay}
          <span
            class="font-mono font-bold text-lg"
            style="color: {getCallColor(node.flowNode.callDisplay)}"
          >
            {node.flowNode.callDisplay}
          </span>
        {/if}
        <span class="text-sm text-text-primary truncate">{node.flowNode.label}</span>
      </div>
      <button
        class="shrink-0 w-7 h-7 rounded-[--radius-md] flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors cursor-pointer"
        onclick={onClose}
        aria-label="Close detail panel"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
        </svg>
      </button>
    </div>

    <!-- Metadata badges -->
    <div class="flex items-center gap-2 flex-wrap">
      {#if node.flowNode.turn}
        <span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-bg-surface text-text-muted">
          {node.flowNode.turn === "opener" ? "Opener" : "Responder"}
        </span>
      {/if}
      {#if node.flowNode.recommendation}
        <span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-bg-surface text-text-muted">
          {node.flowNode.recommendation}
        </span>
      {/if}
      {#if node.flowNode.disclosure}
        <span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-bg-surface text-text-muted">
          {node.flowNode.disclosure}
        </span>
      {/if}
    </div>
  </div>

  <!-- Body -->
  <div class="flex-1 overflow-y-auto p-4">
    {#if node.flowNode.explanationText}
      <p class="text-xs text-text-secondary mb-4">{node.flowNode.explanationText}</p>
    {/if}

    {#if isUserModule && matchedSurfaces.length > 0}
      <ParameterPanel surfaces={matchedSurfaces} {onParameterChange} />
    {:else if !isUserModule}
      <div class="text-center py-6">
        <p class="text-sm text-text-muted mb-3">System modules are read-only.</p>
        <button
          class="px-4 py-2 rounded-[--radius-md] text-sm font-medium text-text-muted hover:text-text-primary border border-border-subtle hover:border-accent-primary transition-colors cursor-pointer"
          onclick={onFork}
        >
          Fork to Edit
        </button>
      </div>
    {:else}
      <p class="text-sm text-text-muted italic">No configurable parameters for this node.</p>
    {/if}
  </div>
</aside>
