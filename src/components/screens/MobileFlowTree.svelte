<script lang="ts">
  import { slide } from "svelte/transition";
  import type { ModuleFlowTreeViewport, FlowTreeNode, Call } from "../../service";
  import { BidSuit } from "../../service";
  import { BID_SUIT_COLOR_CLASS } from "../shared/tokens";

  interface Props {
    tree: ModuleFlowTreeViewport;
  }

  const { tree }: Props = $props();
  let collapsed = $state(true);
  let expandedNodeId = $state<string | null>(null);

  function bidColorClass(call: Call | null): string {
    if (!call || call.type !== "bid") return "text-text-primary";
    return BID_SUIT_COLOR_CLASS[call.strain as BidSuit] ?? "text-text-primary";
  }

  function disclosureLabel(d: string): string {
    switch (d) {
      case "alert": return "Alert";
      case "announcement": return "Announce";
      case "natural": return "Natural";
      case "standard": return "Standard";
      default: return d;
    }
  }

  const REC_CLASSES: Record<string, string> = {
    must: "bg-[color-mix(in_srgb,var(--color-accent-success)_20%,transparent)] text-accent-success",
    should: "bg-[color-mix(in_srgb,var(--color-accent-primary)_20%,transparent)] text-accent-primary",
    may: "bg-bg-elevated text-text-secondary",
    avoid: "bg-[color-mix(in_srgb,var(--color-accent-danger)_20%,transparent)] text-accent-danger",
  };

  function toggleNode(id: string) {
    expandedNodeId = expandedNodeId === id ? null : id;
  }

  function hasDetail(node: FlowTreeNode): boolean {
    return !!(
      node.recommendation ||
      node.disclosure ||
      (node.explanationText && node.explanationText !== "internal") ||
      node.clauses.length > 0
    );
  }
</script>

{#snippet nodeRow(node: FlowTreeNode)}
  {#if node.call}
    {@const indent = Math.min(node.depth, 4) * 12 + 8}
    {@const expanded = expandedNodeId === node.id}
    {@const tappable = hasDetail(node)}
    <button
      class="w-full flex items-center gap-2 min-h-[44px] py-2 pr-3 text-left transition-colors
        {tappable ? 'cursor-pointer active:bg-bg-elevated/40' : 'cursor-default'}
        {expanded ? 'bg-bg-elevated/30' : ''}"
      style:padding-left="{indent}px"
      onclick={() => tappable && toggleNode(node.id)}
      aria-expanded={tappable ? expanded : undefined}
      type="button"
    >
      {#if node.turn}
        <span
          class="inline-flex items-center justify-center shrink-0 rounded-full font-bold text-white"
          style="width: 16px; height: 16px; font-size: 9px; background-color: {node.turn === 'opener'
            ? 'var(--color-accent-primary)'
            : 'var(--color-accent-success)'}"
        >{node.turn === "opener" ? "O" : "R"}</span>
      {/if}
      {#if node.callDisplay}
        <span class="font-mono font-bold shrink-0 {bidColorClass(node.call)}" style="font-size: var(--text-label, 14px)">{node.callDisplay}</span>
      {/if}
      <span class="text-text-secondary truncate" style="font-size: var(--text-label, 14px)">{node.label}</span>
      {#if node.recommendation}
        {@const cls = REC_CLASSES[node.recommendation] ?? ""}
        <span class="shrink-0 font-semibold px-1.5 py-0.5 rounded-full {cls}" style="font-size: 10px">{node.recommendation}</span>
      {/if}
      {#if tappable}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0 text-text-muted transition-transform ml-auto {expanded ? 'rotate-180' : ''}"
          aria-hidden="true"
        ><polyline points="6 9 12 15 18 9" /></svg>
      {/if}
    </button>

    {#if expanded}
      <div
        class="border-t border-border-subtle/50"
        style:padding-left="{indent + 16}px"
        transition:slide={{ duration: 200 }}
      >
        <div class="py-2 pr-3 space-y-1" style="background: color-mix(in srgb, var(--color-bg-elevated) 50%, transparent)">
          {#if node.disclosure}
            <span class="inline-block text-text-muted font-semibold px-1.5 py-0.5 rounded bg-bg-elevated" style="font-size: 10px">{disclosureLabel(node.disclosure)}</span>
          {/if}
          {#if node.explanationText && node.explanationText !== "internal"}
            <p class="text-text-muted leading-snug" style="font-size: var(--text-caption, 12px)">{node.explanationText}</p>
          {/if}
          {#if node.clauses.length > 0}
            <div class="space-y-0.5">
              <span class="text-text-muted font-semibold" style="font-size: 10px">Requirements:</span>
              {#each node.clauses as clause, i (i)}
                <div class="flex items-start gap-1.5 {clause.isPublic ? 'text-text-secondary' : 'text-text-muted italic'}" style="font-size: var(--text-caption, 12px)">
                  <span class="shrink-0 mt-1" style="font-size: 8px">&#x2022;</span>
                  <span>{clause.description}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
  {#each node.children as child (child.id)}
    {@render nodeRow(child)}
  {/each}
{/snippet}

<div class="bg-bg-card rounded-[--radius-lg] border border-border-subtle overflow-hidden">
  <button
    class="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-bg-elevated/30 transition-colors"
    onclick={() => collapsed = !collapsed}
    aria-expanded={!collapsed}
    type="button"
  >
    <span class="text-text-muted uppercase tracking-wide" style="font-size: var(--text-caption, 12px); font-weight: 600">
      Conversation Flow
      <span class="normal-case tracking-normal font-normal ml-1">({tree.nodeCount} bids)</span>
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
    <div class="border-t border-border-subtle">
      {@render nodeRow(tree.root)}
    </div>
  {/if}
</div>
