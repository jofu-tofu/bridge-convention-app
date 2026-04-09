<script lang="ts">
  import type { FlowChartNode } from "./flow-chart-types";

  interface Props {
    node: FlowChartNode;
    selected: boolean;
    onSelect: (nodeId: string) => void;
  }

  let { node, selected, onSelect }: Props = $props();

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

<foreignObject
  x={node.x}
  y={node.y}
  width={node.width}
  height={node.height}
>
  <button
    xmlns="http://www.w3.org/1999/xhtml"
    class="w-full h-full rounded-[--radius-md] border px-3 py-1.5 flex items-center gap-2 text-left transition-all cursor-pointer
      {selected
        ? 'bg-accent-primary/10 border-accent-primary ring-1 ring-accent-primary'
        : 'bg-bg-card border-border-subtle hover:border-border-prominent'}"
    onclick={() => onSelect(node.id)}
  >
    {#if node.flowNode.turn}
      <span class="shrink-0 text-[10px] font-semibold text-text-muted uppercase">
        {node.flowNode.turn === "opener" ? "O" : "R"}
      </span>
    {/if}

    {#if node.flowNode.callDisplay}
      <span
        class="shrink-0 font-mono font-bold text-sm"
        style="color: {getCallColor(node.flowNode.callDisplay)}"
      >
        {node.flowNode.callDisplay}
      </span>
    {/if}

    <span class="flex-1 min-w-0 text-xs text-text-secondary truncate">
      {node.flowNode.label}
    </span>

    {#if node.flowNode.recommendation}
      <span class="shrink-0 text-[9px] font-medium px-1 py-0.5 rounded bg-bg-surface text-text-muted">
        {node.flowNode.recommendation}
      </span>
    {/if}
  </button>
</foreignObject>
