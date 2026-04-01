<script lang="ts">
  import type { PipelineResult } from "../../../service/debug-types";
  import type { TeachingProjection } from "../../../service";
  import { formatCall } from "./debug-helpers";
  import DebugSection from "./DebugSection.svelte";

  interface Props {
    pipelineResult: PipelineResult | null;
    teachingProjection: TeachingProjection | null;
  }

  let { pipelineResult, teachingProjection }: Props = $props();
</script>

<DebugSection
  title="Pipeline"
  count={pipelineResult ? pipelineResult.truthSet.length + pipelineResult.acceptableSet.length : null}
  preview={pipelineResult?.selected ? formatCall(pipelineResult.selected.call) + " — " + (pipelineResult.selected.proposal.teachingLabel?.name ?? pipelineResult.selected.proposal.meaningId) : pipelineResult ? "no match (pass)" : null}
>
  {#if pipelineResult}
    {@const pr = pipelineResult}
    {@const tp = teachingProjection}

    <!-- Winner (always visible, compact) -->
    {#if pr.selected}
      <div class="mb-1.5 px-1.5 py-1 bg-green-900/20 rounded border border-green-500/30 flex items-baseline gap-1.5 flex-wrap">
        <span class="text-sm font-bold text-green-300">{formatCall(pr.selected.call)}</span>
        <span class="text-xs text-green-200">{pr.selected.proposal.teachingLabel?.name ?? pr.selected.proposal.meaningId}</span>
        <span class="text-[10px] text-text-muted">band:{pr.selected.proposal.ranking?.recommendationBand ?? "—"} spec:{pr.selected.proposal.ranking?.specificity ?? "—"}</span>
      </div>
    {:else}
      <div class="mb-1.5 px-1.5 py-1 bg-yellow-900/20 rounded border border-yellow-500/30 text-xs text-yellow-300">
        No candidate matched — pass
      </div>
    {/if}

    <!-- Matched (truth set) — collapsed if >2 -->
    {#if pr.truthSet.length > 0}
      <DebugSection title="Matched" count={pr.truthSet.length} nested open={pr.truthSet.length <= 3}>
        {#each pr.truthSet as carrier, i (carrier.proposal.meaningId + ':' + i)}
          <div class="mb-0.5 border-l-2 border-green-500/40 pl-1.5">
            <span class="text-green-300 font-bold">{formatCall(carrier.call)}</span>
            <span class="text-text-primary ml-1">{carrier.proposal.teachingLabel?.name ?? carrier.proposal.meaningId}</span>
            <div class="text-[10px] text-text-muted leading-tight">
              {#each carrier.proposal.clauses as clause, ci (clause.factId + clause.operator + ':' + ci)}
                <span class="{clause.satisfied ? 'text-green-400/70' : 'text-red-400/70'}">{clause.satisfied ? '+' : '-'}{clause.description}</span><span class="mx-0.5">|</span>
              {/each}
            </div>
          </div>
        {/each}
      </DebugSection>
    {/if}

    <!-- Not this hand (acceptable set) — collapsed by default -->
    {#if pr.acceptableSet.length > 0}
      <DebugSection title="Not this hand" count={pr.acceptableSet.length} nested>
        {#each pr.acceptableSet as carrier, i (carrier.proposal.meaningId + ':' + i)}
          <div class="mb-0.5 border-l-2 border-text-muted/30 pl-1.5">
            <span class="text-text-muted font-bold">{formatCall(carrier.call)}</span>
            <span class="text-text-muted ml-1">{carrier.proposal.teachingLabel?.name ?? carrier.proposal.meaningId}</span>
            <div class="text-[10px]">
              {#each (carrier.proposal.clauses ?? []).filter(c => !c.satisfied) as clause, ci (clause.factId + clause.operator + ':' + ci)}
                <div class="text-red-400/70 leading-tight">
                  {clause.description}
                  {#if clause.observedValue !== undefined}
                    <span class="text-text-muted">(have: {String(clause.observedValue)}, need: {typeof clause.value === 'object' && clause.value !== null && 'min' in clause.value && 'max' in clause.value ? `${String(clause.value.min)}-${String(clause.value.max)}` : String(clause.value)})</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </DebugSection>
    {/if}

    <!-- Eliminated — collapsed by default -->
    {#if pr.eliminated.length > 0}
      <DebugSection title="Eliminated" count={pr.eliminated.length} nested>
        {#each pr.eliminated as carrier, i (carrier.proposal.meaningId + ':' + i)}
          <div class="text-[10px] text-text-muted leading-tight">
            <span class="text-red-400/60">{carrier.proposal.meaningId}</span>
            <span class="ml-0.5">— {carrier.traces.elimination?.reason ?? 'Unknown'}</span>
          </div>
        {/each}
      </DebugSection>
    {/if}

    <!-- WhyNot — collapsed by default -->
    {#if tp?.whyNot && tp.whyNot.length > 0}
      <DebugSection title="Why not these?" count={tp.whyNot.length} nested>
        {#each tp.whyNot as wn, i (wn.call.type + (wn.call.type === 'bid' ? wn.call.level + wn.call.strain : '') + ':' + i)}
          <div class="text-[10px] leading-tight">
            <span class="text-yellow-400">{formatCall(wn.call)}</span>
            <span class="text-text-muted ml-0.5">— eliminated at {wn.eliminationStage}</span>
          </div>
        {/each}
      </DebugSection>
    {/if}

    <!-- Hand space summary -->
    {#if tp?.handSpace}
      <div class="mt-1 pt-1 border-t border-border-subtle/30 text-[10px]">
        <span class="text-text-muted font-semibold">Expects:</span>
        <span class="text-text-primary ml-1">{tp.handSpace.hcpRange.min}-{tp.handSpace.hcpRange.max} HCP, {tp.handSpace.shapeDescription}</span>
        {#if tp.handSpace.partnerSummary}
          <span class="text-text-muted ml-1">| partner: {tp.handSpace.partnerSummary}</span>
        {/if}
      </div>
    {/if}
  {:else}
    <div class="text-text-muted italic text-[10px]">No pipeline data</div>
  {/if}
</DebugSection>
