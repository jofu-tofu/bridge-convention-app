<script lang="ts">
  import type { ModuleFlowTreeViewport, FlowTreeNode, Call } from "../../service";
  import { BidSuit } from "../../service";
  import { BID_SUIT_COLOR_CLASS } from "../shared/tokens";

  interface Props {
    tree: ModuleFlowTreeViewport;
  }

  const { tree }: Props = $props();
  let collapsed = $state(true);

  function bidColorClass(call: Call | null): string {
    if (!call || call.type !== "bid") return "text-text-primary";
    return BID_SUIT_COLOR_CLASS[call.strain as BidSuit] ?? "text-text-primary";
  }

  function countNodes(node: FlowTreeNode, maxDepth: number): number {
    if (node.depth > maxDepth) return 0;
    let count = node.call ? 1 : 0;
    for (const child of node.children) {
      count += countNodes(child, maxDepth);
    }
    return count;
  }

  function countDeepNodes(node: FlowTreeNode, maxDepth: number): number {
    if (node.depth <= maxDepth) {
      let count = 0;
      for (const child of node.children) {
        count += countDeepNodes(child, maxDepth);
      }
      return count;
    }
    let count = 1;
    for (const child of node.children) {
      count += countDeepNodes(child, maxDepth);
    }
    return count;
  }

  const DEPTH_CAP = 3;
  const visibleCount = $derived(countNodes(tree.root, DEPTH_CAP));
  const deepCount = $derived(countDeepNodes(tree.root, DEPTH_CAP));
</script>

{#snippet nodeRow(node: FlowTreeNode)}
  {#if node.depth <= DEPTH_CAP}
    {#if node.call}
      <div
        class="flex items-center gap-2 py-1"
        style:padding-left="{node.depth * 16}px"
      >
        {#if node.turn}
          <span
            class="inline-flex items-center justify-center shrink-0 rounded-full text-[9px] font-bold text-white"
            style="width: 13px; height: 13px; background-color: {node.turn === 'opener'
              ? 'var(--color-accent-primary)'
              : 'var(--color-accent-success)'}"
          >{node.turn === "opener" ? "O" : "R"}</span>
        {/if}
        {#if node.callDisplay}
          <span class="font-mono text-xs font-bold {bidColorClass(node.call)}">{node.callDisplay}</span>
        {/if}
        <span class="text-xs text-text-secondary truncate">{node.label}</span>
      </div>
    {/if}
    {#each node.children as child (child.id)}
      {@render nodeRow(child)}
    {/each}
  {/if}
{/snippet}

<div class="bg-bg-card rounded-[--radius-lg] border border-border-subtle overflow-hidden">
  <button
    class="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-bg-elevated/30 transition-colors"
    onclick={() => collapsed = !collapsed}
    aria-expanded={!collapsed}
  >
    <span class="text-xs font-semibold text-text-muted uppercase tracking-wide">
      Conversation Flow
      <span class="normal-case tracking-normal font-normal ml-1">({visibleCount} bids)</span>
    </span>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="text-text-muted transition-transform {collapsed ? '' : 'rotate-180'}"
      aria-hidden="true"
    ><polyline points="6 9 12 15 18 9" /></svg>
  </button>

  {#if !collapsed}
    <div class="border-t border-border-subtle px-4 py-2">
      <div class="border-l-2 border-border-subtle pl-2">
        {@render nodeRow(tree.root)}
        {#if deepCount > 0}
          <p class="text-[10px] text-text-muted mt-1 pl-4">+{deepCount} more bid{deepCount === 1 ? '' : 's'}</p>
        {/if}
      </div>
    </div>
  {/if}
</div>
