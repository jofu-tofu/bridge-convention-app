<script lang="ts">
  import type { ModuleFlowTreeViewport, FlowTreeNode, Call } from "../../service";
  import { BidSuit } from "../../service";
  import { BID_SUIT_COLOR_CLASS } from "../shared/tokens";

  interface Props {
    tree: ModuleFlowTreeViewport;
  }

  const { tree }: Props = $props();

  function bidColorClass(call: Call | null): string {
    if (!call || call.type !== "bid") return "text-text-primary";
    return BID_SUIT_COLOR_CLASS[call.strain as BidSuit] ?? "text-text-primary";
  }
</script>

{#snippet subtree(node: FlowTreeNode)}
  <div class="ft-subtree">
    <div
      class="ft-node"
      title="{node.callDisplay ? `${node.callDisplay} — ` : ''}{node.label}{node.turn ? ` (${node.turn})` : ''}"
    >
      {#if node.turn}
        <span
          class="ft-badge"
          style:background-color={node.turn === "opener"
            ? "var(--color-accent-primary)"
            : "var(--color-accent-success)"}
        >{node.turn === "opener" ? "O" : "R"}</span>
      {/if}
      {#if node.callDisplay}
        <span class="ft-bid {bidColorClass(node.call)}">{node.callDisplay}</span>
      {/if}
      <span class="ft-label">{node.label}</span>
    </div>
    {#if node.children.length > 0}
      <div class="ft-children">
        {#each node.children as child (child.id)}
          <div class="ft-child">
            {@render subtree(child)}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

<div
  class="ft-root"
  role="img"
  aria-label="Conversation flow tree showing bidding structure for this module"
>
  {@render subtree(tree.root)}
</div>

<style>
  /* ── Tree structure ──────────────────────────────────────── */

  .ft-root {
    padding: 10px 8px;
  }

  .ft-subtree {
    display: flex;
    align-items: center;
  }

  .ft-children {
    display: flex;
    flex-direction: column;
    margin-left: 22px;
    position: relative;
  }

  .ft-child {
    position: relative;
    padding: 3px 0;
  }

  /* ── Connector lines ─────────────────────────────────────── */

  /* Horizontal stub from vertical bar → child node */
  .ft-child::before {
    content: "";
    position: absolute;
    left: -22px;
    top: 50%;
    width: 22px;
    border-top: 1.5px solid var(--color-border-subtle);
    opacity: 0.4;
  }

  /* Vertical bar segment (each child draws its portion) */
  .ft-child::after {
    content: "";
    position: absolute;
    left: -22px;
    top: 0;
    bottom: 0;
    border-left: 1.5px solid var(--color-border-subtle);
    opacity: 0.4;
  }

  /* First child: vertical starts at midpoint */
  .ft-child:first-child::after {
    top: 50%;
  }

  /* Last child: vertical ends at midpoint */
  .ft-child:last-child::after {
    bottom: 50%;
  }

  /* Only child: no vertical segment needed */
  .ft-child:only-child::after {
    display: none;
  }

  /* ── Node styling ────────────────────────────────────────── */

  .ft-node {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: var(--color-bg-elevated);
    border: 1px solid color-mix(in srgb, var(--color-accent-primary) 20%, transparent);
    border-left: 2px solid var(--color-accent-primary);
    border-radius: 4px;
    white-space: nowrap;
    font-size: 10px;
    line-height: 1;
    flex-shrink: 0;
    cursor: default;
    transition: border-color 0.15s;
  }

  .ft-node:hover {
    border-color: color-mix(in srgb, var(--color-accent-primary) 45%, transparent);
    border-left-color: var(--color-accent-primary);
  }

  .ft-bid {
    font-family: ui-monospace, monospace;
    font-weight: 700;
    font-size: 11px;
  }

  .ft-label {
    color: var(--color-text-secondary);
    font-size: 9px;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ft-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    font-size: 7px;
    font-weight: 700;
    color: var(--color-bg-base);
    flex-shrink: 0;
  }
</style>
