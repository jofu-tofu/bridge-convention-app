<script lang="ts">
  import type { ModuleFlowTreeViewport, FlowTreeNode, Call } from "../../service";
  import { BidSuit } from "../../service";
  import { BID_SUIT_COLOR_CLASS } from "../shared/tokens";

  interface Props {
    tree: ModuleFlowTreeViewport;
    scale?: number;
  }

  const { tree, scale = 1 }: Props = $props();

  /** Active hover tooltip state — fixed-positioned via portal to escape overflow containers. */
  let tooltip = $state<{
    node: FlowTreeNode;
    x: number;
    y: number;
    flipUp: boolean;
    flipLeft: boolean;
  } | null>(null);

  let hoverTimer: ReturnType<typeof setTimeout> | null = null;

  function positionTooltip(rect: DOMRect) {
    const tipH = 120 * scale;
    const tipW = 260 * scale;
    const flipUp = rect.bottom + tipH > window.innerHeight;
    const flipLeft = rect.right + tipW > window.innerWidth;
    return { flipUp, flipLeft, x: flipLeft ? rect.left : rect.right + 8, y: flipUp ? rect.top : rect.bottom + 4 };
  }

  function clearHoverTimer() {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
  }

  /**
   * Svelte use: action — attaches native mouseenter/mouseleave listeners directly,
   * bypassing Svelte 5 event delegation which doesn't work in recursive {#snippet} blocks.
   */
  function hoverAction(el: HTMLElement, getNode: () => FlowTreeNode) {
    function onEnter() {
      const node = getNode();
      if (!node.call) return;
      clearHoverTimer();
      hoverTimer = setTimeout(() => {
        const rect = el.getBoundingClientRect();
        const pos = positionTooltip(rect);
        tooltip = { node, ...pos };
      }, 250);
    }
    function onLeave() {
      clearHoverTimer();
      tooltip = null;
    }
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    return {
      destroy() {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mouseleave", onLeave);
        clearHoverTimer();
      },
    };
  }

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

  function recommendationClass(r: string | null): string {
    switch (r) {
      case "must": return "rec-must";
      case "should": return "rec-should";
      case "may": return "rec-may";
      case "avoid": return "rec-avoid";
      default: return "";
    }
  }
</script>

{#snippet subtree(node: FlowTreeNode)}
  <div class="ft-subtree">
    <div
      class="ft-node"
      use:hoverAction={() => node}
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

<!-- Fixed-position tooltip portal (escapes overflow containers) -->
{#if tooltip}
  <div
    class="ft-tooltip"
    style="
      left: {tooltip.flipLeft ? 'auto' : `${tooltip.x}px`};
      right: {tooltip.flipLeft ? `${window.innerWidth - tooltip.x + 8}px` : 'auto'};
      top: {tooltip.flipUp ? 'auto' : `${tooltip.y}px`};
      bottom: {tooltip.flipUp ? `${window.innerHeight - tooltip.y + 4}px` : 'auto'};
    "
    role="tooltip"
  >
    <div class="ft-tooltip-header">
      <span class="ft-tooltip-call {bidColorClass(tooltip.node.call)}">{tooltip.node.callDisplay}</span>
      <span class="ft-tooltip-meaning">{tooltip.node.label}</span>
      {#if tooltip.node.recommendation}
        <span class="ft-tooltip-rec {recommendationClass(tooltip.node.recommendation)}">{tooltip.node.recommendation}</span>
      {/if}
      {#if tooltip.node.disclosure}
        <span class="ft-tooltip-disclosure">{disclosureLabel(tooltip.node.disclosure)}</span>
      {/if}
    </div>
    {#if tooltip.node.explanationText && tooltip.node.explanationText !== "internal"}
      <p class="ft-tooltip-explanation">{tooltip.node.explanationText}</p>
    {/if}
    {#if tooltip.node.clauses.length > 0}
      <div class="ft-tooltip-clauses">
        {#each tooltip.node.clauses as clause, i (i)}
          <span class="ft-tooltip-clause" class:ft-tooltip-clause-internal={!clause.isPublic}>{clause.description}</span>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  /* ── Tree structure ──────────────────────────────────────── */

  .ft-root {
    padding: calc(10px * var(--ft-scale, 1)) calc(8px * var(--ft-scale, 1));
  }

  .ft-subtree {
    display: flex;
    align-items: center;
  }

  .ft-children {
    display: flex;
    flex-direction: column;
    margin-left: calc(22px * var(--ft-scale, 1));
    position: relative;
  }

  .ft-child {
    position: relative;
    padding: calc(3px * var(--ft-scale, 1)) 0;
  }

  /* ── Connector lines ─────────────────────────────────────── */

  /* Horizontal stub from vertical bar → child node */
  .ft-child::before {
    content: "";
    position: absolute;
    left: calc(-22px * var(--ft-scale, 1));
    top: 50%;
    width: calc(22px * var(--ft-scale, 1));
    border-top: calc(1.5px * var(--ft-scale, 1)) solid var(--color-border-subtle);
    opacity: 0.4;
  }

  /* Vertical bar segment (each child draws its portion) */
  .ft-child::after {
    content: "";
    position: absolute;
    left: calc(-22px * var(--ft-scale, 1));
    top: 0;
    bottom: 0;
    border-left: calc(1.5px * var(--ft-scale, 1)) solid var(--color-border-subtle);
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
    gap: calc(4px * var(--ft-scale, 1));
    padding: calc(3px * var(--ft-scale, 1)) calc(8px * var(--ft-scale, 1));
    background: var(--color-bg-elevated);
    border: 1px solid color-mix(in srgb, var(--color-accent-primary) 20%, transparent);
    border-left: 2px solid var(--color-accent-primary);
    border-radius: calc(4px * var(--ft-scale, 1));
    white-space: nowrap;
    font-size: calc(10px * var(--ft-scale, 1));
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
    font-size: calc(11px * var(--ft-scale, 1));
  }

  .ft-label {
    color: var(--color-text-secondary);
    font-size: calc(9px * var(--ft-scale, 1));
  }

  .ft-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: calc(13px * var(--ft-scale, 1));
    height: calc(13px * var(--ft-scale, 1));
    border-radius: 50%;
    font-size: calc(7px * var(--ft-scale, 1));
    font-weight: 700;
    color: var(--color-bg-base);
    flex-shrink: 0;
  }

  /* ── Tooltip ─────────────────────────────────────────────── */

  .ft-tooltip {
    position: fixed;
    z-index: var(--z-modal, 50);
    min-width: calc(180px * var(--ft-scale, 1));
    max-width: calc(280px * var(--ft-scale, 1));
    width: max-content;
    padding: calc(8px * var(--ft-scale, 1)) calc(10px * var(--ft-scale, 1));
    background: var(--color-bg-card);
    border: 1px solid var(--color-border-subtle);
    border-radius: calc(6px * var(--ft-scale, 1));
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.3);
    pointer-events: none;
  }

  .ft-tooltip-header {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--ft-scale, 1));
    flex-wrap: wrap;
  }

  .ft-tooltip-call {
    font-family: ui-monospace, monospace;
    font-weight: 700;
    font-size: calc(13px * var(--ft-scale, 1));
  }

  .ft-tooltip-meaning {
    font-size: calc(12px * var(--ft-scale, 1));
    color: var(--color-text-secondary);
    line-height: 1.3;
  }

  .ft-tooltip-rec {
    font-weight: 600;
    padding: calc(1px * var(--ft-scale, 1)) calc(6px * var(--ft-scale, 1));
    border-radius: 9999px;
    font-size: calc(10px * var(--ft-scale, 1));
  }

  .rec-must {
    background: color-mix(in srgb, var(--color-accent-success) 20%, transparent);
    color: var(--color-accent-success);
  }
  .rec-should {
    background: color-mix(in srgb, var(--color-accent-primary) 20%, transparent);
    color: var(--color-accent-primary);
  }
  .rec-may {
    background: var(--color-bg-elevated);
    color: var(--color-text-secondary);
  }
  .rec-avoid {
    background: color-mix(in srgb, var(--color-accent-danger) 20%, transparent);
    color: var(--color-accent-danger);
  }

  .ft-tooltip-disclosure {
    color: var(--color-text-muted);
    font-size: calc(10px * var(--ft-scale, 1));
  }

  .ft-tooltip-explanation {
    margin-top: calc(4px * var(--ft-scale, 1));
    font-size: calc(11px * var(--ft-scale, 1));
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  .ft-tooltip-clauses {
    margin-top: calc(5px * var(--ft-scale, 1));
    padding-top: calc(5px * var(--ft-scale, 1));
    border-top: 1px solid var(--color-border-subtle);
    display: flex;
    flex-direction: column;
    gap: calc(2px * var(--ft-scale, 1));
  }

  .ft-tooltip-clause {
    font-size: calc(10px * var(--ft-scale, 1));
    color: var(--color-text-secondary);
    line-height: 1.3;
  }

  .ft-tooltip-clause-internal {
    color: var(--color-text-muted);
    font-style: italic;
  }
</style>
