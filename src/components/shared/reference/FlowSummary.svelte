<script lang="ts">
  import type { FlowTreeNode, ModuleFlowTreeViewport } from "../../../service";

  interface Props {
    tree: ModuleFlowTreeViewport;
    /** Max depth to render (inclusive). Nodes deeper than this collapse into a "+N continuations" badge. */
    maxDepth?: number;
    /** Max children to render per node; remainder collapsed into a "+N more" badge. */
    maxChildren?: number;
  }

  const { tree, maxDepth = 2, maxChildren = 8 }: Props = $props();

  function countDescendants(node: FlowTreeNode): number {
    let n = 0;
    for (const c of node.children) {
      n += 1 + countDescendants(c);
    }
    return n;
  }

  function visibleChildren(node: FlowTreeNode): readonly FlowTreeNode[] {
    return node.children.slice(0, maxChildren);
  }

  function hiddenChildrenCount(node: FlowTreeNode): number {
    return Math.max(0, node.children.length - maxChildren);
  }
</script>

<section
  class="flow-summary rounded-[--radius-lg] border border-border-default bg-bg-card p-4"
  aria-labelledby="flow-summary-heading"
>
  <div class="mb-4 flex items-center justify-between gap-3">
    <h2
      id="flow-summary-heading"
      class="text-[--text-heading] font-semibold text-text-primary"
    >
      Flow at a Glance
    </h2>
    <span class="text-[--text-label] uppercase tracking-[0.12em] text-text-muted">
      {tree.nodeCount} calls · depth {tree.maxDepth}
    </span>
  </div>

  <div class="fs-scroll">
    {@render subtree(tree.root, 0)}
  </div>
</section>

{#snippet subtree(node: FlowTreeNode, depth: number)}
  <div class="fs-subtree">
    <div class="fs-node">
      {#if node.turn}
        <span
          class="fs-badge"
          style:background-color={node.turn === "opener"
            ? "var(--color-accent-primary)"
            : "var(--color-accent-success)"}
          aria-label={node.turn}
        >{node.turn === "opener" ? "O" : "R"}</span>
      {/if}
      {#if node.callDisplay}
        <span class="fs-bid">{node.callDisplay}</span>
      {/if}
      <span class="fs-label">{node.label}</span>
    </div>
    {#if node.children.length > 0}
      {#if depth >= maxDepth}
        <div class="fs-overflow">+{countDescendants(node)} continuations</div>
      {:else}
        <div class="fs-children">
          {#each visibleChildren(node) as child (child.id)}
            <div class="fs-child">
              {@render subtree(child, depth + 1)}
            </div>
          {/each}
          {#if hiddenChildrenCount(node) > 0}
            <div class="fs-child">
              <div class="fs-overflow">+{hiddenChildrenCount(node)} more</div>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
{/snippet}

<style>
  .fs-scroll {
    overflow-x: auto;
    max-width: 100%;
  }

  .fs-subtree {
    display: flex;
    align-items: center;
  }

  .fs-children {
    display: flex;
    flex-direction: column;
    margin-left: 22px;
    position: relative;
  }

  .fs-child {
    position: relative;
    padding: 3px 0;
  }

  .fs-child::before {
    content: "";
    position: absolute;
    left: -22px;
    top: 50%;
    width: 22px;
    border-top: 1.5px solid var(--color-border-default);
    opacity: 0.7;
  }

  .fs-child::after {
    content: "";
    position: absolute;
    left: -22px;
    top: 0;
    bottom: 0;
    border-left: 1.5px solid var(--color-border-default);
    opacity: 0.7;
  }

  .fs-child:first-child::before { display: none; }
  .fs-child:first-child::after {
    top: 50%;
    width: 22px;
    border-top: 1.5px solid var(--color-border-default);
    border-top-left-radius: 6px;
  }

  .fs-child:last-child::before { display: none; }
  .fs-child:last-child::after {
    bottom: 50%;
    width: 22px;
    border-bottom: 1.5px solid var(--color-border-default);
    border-bottom-left-radius: 6px;
  }

  .fs-child:only-child::before { display: block; }
  .fs-child:only-child::after { display: none; }

  .fs-node {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: var(--color-bg-elevated);
    border: 1px solid color-mix(in srgb, var(--color-accent-primary) 20%, transparent);
    border-left: 2px solid var(--color-accent-primary);
    border-radius: 4px;
    white-space: nowrap;
    font-size: 12px;
    line-height: 1.2;
    flex-shrink: 0;
  }

  .fs-bid {
    font-family: ui-monospace, monospace;
    font-weight: 700;
  }

  .fs-label {
    color: var(--color-text-secondary);
    font-size: 11px;
  }

  .fs-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    font-size: 8px;
    font-weight: 700;
    color: var(--color-bg-base);
    flex-shrink: 0;
  }

  .fs-overflow {
    display: inline-block;
    padding: 3px 8px;
    font-size: 11px;
    color: var(--color-text-muted);
    background: var(--color-bg-base);
    border: 1px dashed var(--color-border-subtle);
    border-radius: 9999px;
    margin-left: 6px;
  }

  @media print {
    .flow-summary {
      display: none;
    }
  }
</style>
