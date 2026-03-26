<script lang="ts">
  import type { BundleFlowTreeViewport } from "../../service";
  import { BidSuit } from "../../service";
  import { BID_SUIT_COLOR_CLASS } from "../shared/tokens";
  import {
    layoutTree,
    computeSvgDimensions,
    buildEdgePath,
    collectEdges,
    flattenNodes,
    buildModuleColorMap,
    MODULE_COLORS,
  } from "./ConversationFlowTree";

  interface Props {
    tree: BundleFlowTreeViewport;
    selectedModuleId: string | null;
    onNodeClick: (moduleId: string) => void;
  }

  const { tree, selectedModuleId, onNodeClick }: Props = $props();

  const positions = $derived(layoutTree(tree.root));
  const dimensions = $derived(computeSvgDimensions(positions));
  const edges = $derived(collectEdges(tree.root));
  const allNodes = $derived(flattenNodes(tree.root));
  const moduleColorMap = $derived(buildModuleColorMap(tree.root));

  function getModuleColor(moduleId: string | null): string {
    if (!moduleId) return "var(--color-text-muted)";
    const idx = moduleColorMap.get(moduleId) ?? 0;
    return MODULE_COLORS[idx % MODULE_COLORS.length]!;
  }

  function getBidColorClass(node: { call: import("../../service").Call | null }): string {
    if (!node.call || node.call.type !== "bid") return "text-text-primary";
    return BID_SUIT_COLOR_CLASS[node.call.strain as BidSuit] ?? "text-text-primary";
  }

  function isSelected(moduleId: string | null): boolean {
    return moduleId !== null && moduleId === selectedModuleId;
  }

  function handleNodeClick(moduleId: string | null) {
    if (moduleId) onNodeClick(moduleId);
  }

  function turnBadge(turn: "opener" | "responder" | null): { letter: string; color: string } | null {
    if (turn === "opener") return { letter: "O", color: "var(--color-accent-primary)" };
    if (turn === "responder") return { letter: "R", color: "var(--color-accent-success)" };
    return null;
  }
</script>

<svg
  width={dimensions.width}
  height={dimensions.height}
  class="block"
  role="img"
  aria-label="Conversation flow tree showing how bidding branches across convention modules"
>
  <!-- Edges (behind nodes) -->
  {#each edges as [parentId, childId] (`${parentId}-${childId}`)}
    {@const parentPos = positions.get(parentId)}
    {@const childPos = positions.get(childId)}
    {#if parentPos && childPos}
      <path
        d={buildEdgePath(parentPos, childPos)}
        fill="none"
        stroke="var(--color-border-subtle)"
        stroke-width="1.5"
        opacity="0.6"
      />
    {/if}
  {/each}

  <!-- Nodes -->
  {#each allNodes as node (node.id)}
    {@const pos = positions.get(node.id)}
    {#if pos}
      {@const selected = isSelected(node.moduleId)}
      {@const dimmed = selectedModuleId !== null && !selected}
      {@const badge = turnBadge(node.turn)}
      <g
        transform="translate({pos.x}, {pos.y})"
        class="cursor-pointer"
        opacity={dimmed ? 0.45 : 1}
        role="button"
        tabindex="0"
        aria-label="{node.callDisplay ?? ''} {node.label} — {node.moduleDisplayName ?? 'root'}"
        onclick={() => handleNodeClick(node.moduleId)}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNodeClick(node.moduleId); } }}
      >
        <title>{node.callDisplay ? `${node.callDisplay} — ` : ''}{node.label}{node.turn ? ` (${node.turn})` : ''}</title>
        <!-- Background rect -->
        <rect
          width={pos.width}
          height={pos.height}
          rx="5"
          ry="5"
          fill="var(--color-bg-card)"
          stroke={selected ? "var(--color-accent-primary)" : getModuleColor(node.moduleId)}
          stroke-width={selected ? 2 : 1}
          opacity={selected ? 1 : 0.7}
        />
        <!-- Module color indicator -->
        <rect
          x="0"
          y="0"
          width="3"
          height={pos.height}
          rx="1.5"
          fill={getModuleColor(node.moduleId)}
        />
        <!-- Turn badge -->
        {#if badge}
          <circle cx={pos.width - 10} cy="10" r="7" fill={badge.color} opacity="0.85" />
          <text
            x={pos.width - 10}
            y="10"
            text-anchor="middle"
            dominant-baseline="central"
            font-size="8"
            font-weight="700"
            fill="var(--color-bg-base)"
          >{badge.letter}</text>
        {/if}
        <!-- Bid text -->
        {#if node.callDisplay}
          <text
            x="9"
            y={pos.height / 2}
            dominant-baseline="central"
            font-size="10"
            font-weight="700"
            font-family="monospace"
            fill="currentColor"
            class={getBidColorClass(node)}
          >
            {node.callDisplay}
          </text>
        {/if}
        <!-- Label text -->
        <text
          x={node.callDisplay ? 36 : 9}
          y={pos.height / 2}
          dominant-baseline="central"
          font-size="8"
          fill="var(--color-text-secondary)"
        >
          {node.label.length > 10 ? node.label.slice(0, 9) + '\u2026' : node.label}
        </text>
      </g>
    {/if}
  {/each}
</svg>
