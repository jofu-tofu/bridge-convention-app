<script lang="ts">
  import type { ParseTreeView } from "../../../service";
  import { formatCall } from "../../../service";
  import { formatRuleName } from "../../../service";

  interface Props {
    parseTree: ParseTreeView;
  }

  let { parseTree }: Props = $props();

  let expanded = $state(true);

  function moduleClasses(verdict: string): string {
    switch (verdict) {
      case "selected":
        return "rounded border px-2 py-1.5 text-[--text-label] bg-pt-selected/30 border-pt-selected-accent/30";
      case "applicable":
        return "rounded border px-2 py-1.5 text-[--text-label] bg-pt-applicable/20 border-pt-applicable-accent/20";
      default:
        return "rounded border px-2 py-1.5 text-[--text-label] bg-pt-eliminated/30 border-pt-eliminated-accent/20";
    }
  }

  function moduleLabelClasses(verdict: string): string {
    switch (verdict) {
      case "selected": return "font-medium text-pt-selected-text";
      case "applicable": return "font-medium text-pt-applicable-text";
      default: return "font-medium text-pt-eliminated-text";
    }
  }

  function conditionValueClasses(satisfied: boolean): string {
    return satisfied
      ? "text-fb-incorrect-dim/60"
      : "text-fb-incorrect-emphasis/70";
  }
</script>

<!-- Parse Tree: Decision Chain -->
<div class="pt-1 border-t border-fb-incorrect/20">
  <button
    type="button"
    class="text-[--text-label] text-fb-incorrect-text/60 hover:text-fb-incorrect-dim transition-colors cursor-pointer flex items-center gap-1"
    onclick={() => { expanded = !expanded; }}
    aria-expanded={expanded}
  >
    <span class="shrink-0">{expanded ? "▾" : "▸"}</span>
    <span class="font-medium">Decision path</span>
    <span class="text-[--text-annotation] text-fb-incorrect-text/40">
      — {parseTree.modules.length} convention{parseTree.modules.length === 1 ? "" : "s"} evaluated
    </span>
  </button>
  {#if expanded}
    <div class="mt-1.5 ml-1 space-y-1.5" role="tree" aria-label="Decision path">
      {#each parseTree.modules as mod (mod.moduleId)}
        {@const isSelected = mod.verdict === "selected"}
        {@const isEliminated = mod.verdict === "eliminated"}
        <div class={moduleClasses(mod.verdict)} role="treeitem" aria-selected={isSelected}>
          <!-- Module header -->
          <div class="flex items-center gap-1.5 flex-wrap">
            {#if isSelected}
              <span class="text-accent-success shrink-0" aria-hidden="true">●</span>
            {:else if isEliminated}
              <span class="text-fb-incorrect-emphasis/50 shrink-0" aria-hidden="true">○</span>
            {:else}
              <span class="text-pt-applicable-dot/60 shrink-0" aria-hidden="true">●</span>
            {/if}
            <span class={moduleLabelClasses(mod.verdict)}>
              {formatRuleName(mod.displayLabel)}
            </span>
            {#if isSelected}
              <span class="rounded bg-pt-selected/70 border border-pt-selected-accent/40 px-1.5 py-0.5 text-[--text-annotation] uppercase tracking-wide text-pt-selected-text">
                Selected
              </span>
            {:else if mod.verdict === "applicable"}
              <span class="rounded bg-pt-applicable/70 border border-pt-applicable-accent/40 px-1.5 py-0.5 text-[--text-annotation] uppercase tracking-wide text-pt-applicable-text">
                Also valid
              </span>
            {:else}
              <span class="rounded bg-pt-eliminated/70 border border-pt-eliminated-accent/40 px-1.5 py-0.5 text-[--text-annotation] uppercase tracking-wide text-pt-eliminated-text">
                Ruled out
              </span>
            {/if}
          </div>

          <!-- Conditions -->
          {#if mod.conditions.length > 0}
            <ul class="mt-1 space-y-0.5 ml-4" role="list" aria-label="Conditions for {formatRuleName(mod.displayLabel)}">
              {#each mod.conditions as cond (cond.factId + cond.description)}
                <li class="flex items-center gap-1.5 text-[--text-annotation]">
                  <span
                    class={cond.satisfied ? "text-accent-success" : "text-accent-danger"}
                    aria-hidden="true"
                  >{cond.satisfied ? "✓" : "✗"}</span>
                  <span class="sr-only">{cond.satisfied ? "Passed:" : "Failed:"}</span>
                  <span class={conditionValueClasses(cond.satisfied)}>
                    {cond.description}
                  </span>
                </li>
              {/each}
            </ul>
          {/if}

          <!-- Elimination reason (when no conditions available) -->
          {#if isEliminated && mod.conditions.length === 0 && mod.eliminationReason}
            <p class="mt-0.5 ml-4 text-[--text-annotation] text-fb-incorrect-text/40 italic">
              {mod.eliminationReason}
            </p>
          {/if}

          <!-- Selected path: show the winning meaning + bid -->
          {#if isSelected && parseTree.selectedPath}
            {@const winMeaning = mod.meanings.find(m => m.meaningId === parseTree.selectedPath?.meaningId)}
            {#if winMeaning}
              <div class="mt-1 ml-4 flex items-center gap-1.5 text-[--text-annotation]">
                <span class="text-accent-success" aria-hidden="true">→</span>
                <span class="text-pt-selected-text/80">{winMeaning.displayLabel}</span>
                {#if winMeaning.call}
                  <span class="font-mono font-bold text-pt-selected-text">{formatCall(winMeaning.call)}</span>
                {/if}
              </div>
            {/if}
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
