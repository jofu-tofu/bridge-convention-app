<script lang="ts">
  import type { TreeDisplayRow } from "./DecisionTree";
  import type { Call } from "../../service";
  import { createDummyContext } from "./DecisionTree";
  import { formatCall, formatRuleName } from "../../service";
  import { SvelteSet, SvelteMap } from "svelte/reactivity";

  type DepthMode = "compact" | "study" | "learn";

  interface Props {
    rows: TreeDisplayRow[];
    activePath?: Set<string> | null;
    depth?: DepthMode;
  }

  let { rows, activePath = null, depth = "compact" }: Props = $props();

  const isStudyOrLearn = $derived(depth === "study" || depth === "learn");
  const isLearn = $derived(depth === "learn");

  // All decision nodes start expanded
  let expandedNodes = new SvelteSet<string>();

  // Reset expanded state when rows change (convention switch)
  $effect(() => {
    const _r = rows;
    expandedNodes.clear();
    for (const row of _r) {
      if (row.type === "decision") {
        expandedNodes.add(row.id);
      }
    }
  });

  // Filter visible rows: a row is visible if all its ancestors are expanded
  let visibleRows = $derived.by(() => {
    const result: TreeDisplayRow[] = [];
    const parentMap = new SvelteMap<string, string | null>();
    for (const row of rows) {
      parentMap.set(row.id, row.parentId);
    }

    for (const row of rows) {
      let visible = true;
      let currentId = row.parentId;
      while (currentId !== null) {
        if (!expandedNodes.has(currentId)) {
          visible = false;
          break;
        }
        currentId = parentMap.get(currentId) ?? null;
      }
      if (visible) {
        result.push(row);
      }
    }
    return result;
  });

  // Resolve calls for bid rows using dummy context
  let resolvedCalls = $derived.by(() => {
    const map = new SvelteMap<string, Call | null>();
    const dummyCtx = createDummyContext();

    for (const row of rows) {
      if (row.callResolver) {
        try {
          map.set(row.id, row.callResolver(dummyCtx));
        } catch {
          map.set(row.id, null);
        }
      }
    }
    return map;
  });

  function toggleNode(id: string) {
    if (expandedNodes.has(id)) {
      expandedNodes.delete(id);
    } else {
      expandedNodes.add(id);
    }
  }

  function handleKeydown(e: KeyboardEvent, id: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleNode(id);
    }
  }

  // Precompute connector depths for all visible rows in a single pass.
  // For each row, determines which ancestor depths need vertical connector lines.
  let connectorMap = $derived.by(() => {
    const map = new SvelteMap<number, number[]>();
    for (let rowIndex = 0; rowIndex < visibleRows.length; rowIndex++) {
      const row = visibleRows[rowIndex]!;
      const depths: number[] = [];

      for (let d = 0; d < row.depth; d++) {
        let hasMoreSiblings = false;
        for (let j = rowIndex + 1; j < visibleRows.length; j++) {
          const future = visibleRows[j]!;
          if (future.depth === d) {
            // Found a sibling at same depth — line continues
            hasMoreSiblings = true;
            break;
          }
          if (future.depth < d) {
            // Left this subtree — no sibling at depth d
            break;
          }
        }
        if (hasMoreSiblings) {
          depths.push(d);
        }
      }
      map.set(rowIndex, depths);
    }
    return map;
  });
</script>

<div
  role="tree"
  aria-label="Convention decision tree"
  class="bg-[#1c2530] rounded-[--radius-xl] py-4"
>
  {#each visibleRows as row, i (row.id)}
    {@const isExpanded = expandedNodes.has(row.id)}
    {@const connectors = connectorMap.get(i) ?? []}
    {@const call = resolvedCalls.get(row.id)}
    {@const isActive = activePath === null || activePath.has(row.id)}
    <div
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={false}
      aria-expanded={row.type === "decision" ? isExpanded : undefined}
      class="relative flex items-center min-h-[36px] pr-4"
      style:padding-left="{16 + row.depth * 24}px"
      style:opacity={isActive ? 1 : 0.5}
      class:bg-[rgba(59,130,246,0.08)]={row.type === "decision"}
      class:bg-[rgba(34,197,94,0.08)]={row.type === "bid"}
    >
      <!-- Connector lines -->
      {#each connectors as d (d)}
        <div
          class="absolute top-0 bottom-0 w-px bg-[#475569]"
          style:left="{7 + d * 24}px"
        ></div>
      {/each}

      {#if row.type === "decision"}
        <!-- Decision row: chevron + label + category tag -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center">
            <button
              class="shrink-0 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-200 cursor-pointer mr-2"
              aria-label="Toggle {row.name}"
              onclick={() => toggleNode(row.id)}
              onkeydown={(e) => handleKeydown(e, row.id)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                class="transition-transform {isExpanded ? 'rotate-90' : ''}"
                aria-hidden="true"
              >
                <path d="M8 5l8 7-8 7z" />
              </svg>
            </button>
            <span
              class="text-sm text-slate-200"
              title={row.fullConditionLabel && row.fullConditionLabel !== row.conditionLabel
                ? row.fullConditionLabel
                : undefined}
            >{row.conditionLabel ?? row.name}</span>
            {#if row.conditionCategory}
              <span
                class="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded
                  {row.conditionCategory === 'auction'
                    ? 'bg-[rgba(59,130,246,0.2)] text-[#60a5fa]'
                    : 'bg-[rgba(148,163,184,0.2)] text-slate-400'}"
              >
                {row.conditionCategory === "auction" ? "Auction" : "Hand"}
              </span>
            {/if}
          </div>
          <!-- Study+ teaching explanation -->
          {#if isStudyOrLearn && row.teachingExplanation}
            <div class="text-xs text-slate-400 mt-1 ml-7">{row.teachingExplanation}</div>
          {/if}
          <!-- Study+ denial implication on NO-branch -->
          {#if isStudyOrLearn && row.denialImplication}
            <div class="text-xs text-slate-400 italic mt-1 ml-7">{row.denialImplication}</div>
          {/if}
          <!-- Learn: whyThisMatters -->
          {#if isLearn && row.decisionMetadata?.whyThisMatters}
            <div class="text-xs text-blue-300/80 bg-blue-500/10 rounded px-2 py-1 mt-1 ml-7">{row.decisionMetadata.whyThisMatters}</div>
          {/if}
          <!-- Learn: commonMistake -->
          {#if isLearn && row.decisionMetadata?.commonMistake}
            <div class="text-xs text-amber-300/80 bg-amber-500/10 rounded px-2 py-1 mt-1 ml-7">{row.decisionMetadata.commonMistake}</div>
          {/if}
        </div>
      {:else if row.type === "bid"}
        <!-- Bid row: badge + name + meaning + optional metadata -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 py-1">
            {#if call}
              <span class="bg-[#22c55e] rounded-[--radius-md] px-2.5 py-1 text-white font-mono font-bold text-xs shrink-0">
                {formatCall(call)}
              </span>
            {/if}
            <span class="text-sm text-slate-200 font-medium">{formatRuleName(row.name)}</span>
            {#if row.meaning}
              <span class="text-xs text-slate-400">{row.meaning}</span>
            {/if}
            <!-- Study+ badges -->
            {#if isStudyOrLearn && row.bidMetadata?.isArtificial}
              <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">Artificial</span>
            {/if}
            {#if isStudyOrLearn && row.bidMetadata?.forcingType}
              <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-500/20 text-orange-300">
                {row.bidMetadata.forcingType === "game-forcing" ? "GF"
                  : row.bidMetadata.forcingType === "invitational" ? "Inv"
                  : row.bidMetadata.forcingType === "signoff" ? "Signoff"
                  : "Forcing"}
              </span>
            {/if}
          </div>
          <!-- Learn: whyThisBid -->
          {#if isLearn && row.bidMetadata?.whyThisBid}
            <div class="text-xs text-blue-300/80 bg-blue-500/10 rounded px-2 py-1 mt-1 ml-7">{row.bidMetadata.whyThisBid}</div>
          {/if}
          <!-- Learn: partnerExpects -->
          {#if isLearn && row.bidMetadata?.partnerExpects}
            <div class="text-xs text-slate-400 mt-1 ml-7">Partner expects: {row.bidMetadata.partnerExpects}</div>
          {/if}
          <!-- Learn: commonMistake -->
          {#if isLearn && row.bidMetadata?.commonMistake}
            <div class="text-xs text-amber-300/80 bg-amber-500/10 rounded px-2 py-1 mt-1 ml-7">{row.bidMetadata.commonMistake}</div>
          {/if}
        </div>
      {:else}
        <!-- Fallback row -->
        <span class="text-sm text-slate-500 italic">{formatRuleName(row.name)}</span>
      {/if}
    </div>
  {/each}
</div>
