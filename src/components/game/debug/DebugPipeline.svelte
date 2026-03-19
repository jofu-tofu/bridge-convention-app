<script lang="ts">
  import type { ArbitrationResult } from "../../../core/contracts/module-surface";
  import type { TeachingProjection } from "../../../core/contracts";
  import { fmtCall } from "./debug-helpers";
  import DebugSection from "./DebugSection.svelte";

  interface Props {
    arbitration: ArbitrationResult | null;
    teachingProjection: TeachingProjection | null;
  }

  let { arbitration, teachingProjection }: Props = $props();
</script>

<DebugSection
  title="Pipeline"
  count={arbitration ? arbitration.truthSet.length + arbitration.acceptableSet.length : null}
  preview={arbitration?.selected ? fmtCall(arbitration.selected.call) + " — " + (arbitration.selected.proposal.teachingLabel ?? arbitration.selected.proposal.meaningId) : arbitration ? "no match (pass)" : null}
>
  {#if arbitration}
    {@const arb = arbitration}
    {@const tp = teachingProjection}

    <!-- Winner (always visible, compact) -->
    {#if arb.selected}
      <div class="mb-1.5 px-1.5 py-1 bg-green-900/20 rounded border border-green-500/30 flex items-baseline gap-1.5 flex-wrap">
        <span class="text-sm font-bold text-green-300">{fmtCall(arb.selected.call)}</span>
        <span class="text-xs text-green-200">{arb.selected.proposal.teachingLabel ?? arb.selected.proposal.meaningId}</span>
        <span class="text-[10px] text-text-muted">band:{arb.selected.proposal.ranking.recommendationBand} spec:{arb.selected.proposal.ranking.specificity}</span>
      </div>
    {:else}
      <div class="mb-1.5 px-1.5 py-1 bg-yellow-900/20 rounded border border-yellow-500/30 text-xs text-yellow-300">
        No candidate matched — pass
      </div>
    {/if}

    <!-- Matched (truth set) — collapsed if >2 -->
    {#if arb.truthSet.length > 0}
      <DebugSection title="Matched" count={arb.truthSet.length} nested open={arb.truthSet.length <= 3}>
        {#each arb.truthSet as ep (ep.proposal.meaningId)}
          <div class="mb-0.5 border-l-2 border-green-500/40 pl-1.5">
            <span class="text-green-300 font-bold">{fmtCall(ep.call)}</span>
            <span class="text-text-primary ml-1">{ep.proposal.teachingLabel ?? ep.proposal.meaningId}</span>
            <div class="text-[10px] text-text-muted leading-tight">
              {#each ep.proposal.clauses as clause (clause.factId + clause.operator)}
                <span class="{clause.satisfied ? 'text-green-400/70' : 'text-red-400/70'}">{clause.satisfied ? '+' : '-'}{clause.description}</span><span class="mx-0.5">|</span>
              {/each}
            </div>
          </div>
        {/each}
      </DebugSection>
    {/if}

    <!-- Not this hand (acceptable set) — collapsed by default -->
    {#if arb.acceptableSet.length > 0}
      <DebugSection title="Not this hand" count={arb.acceptableSet.length} nested>
        {#each arb.acceptableSet as ep (ep.proposal.meaningId)}
          <div class="mb-0.5 border-l-2 border-text-muted/30 pl-1.5">
            <span class="text-text-muted font-bold">{fmtCall(ep.call)}</span>
            <span class="text-text-muted ml-1">{ep.proposal.teachingLabel ?? ep.proposal.meaningId}</span>
            <div class="text-[10px]">
              {#each ep.proposal.clauses.filter(c => !c.satisfied) as clause (clause.factId + clause.operator)}
                <div class="text-red-400/70 leading-tight">
                  {clause.description}
                  {#if clause.observedValue !== undefined}
                    <span class="text-text-muted">(have: {String(clause.observedValue)}, need: {typeof clause.value === 'object' && clause.value !== null && 'min' in clause.value ? `${clause.value.min}-${clause.value.max}` : String(clause.value)})</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </DebugSection>
    {/if}

    <!-- Eliminated — collapsed by default -->
    {#if arb.eliminations.length > 0}
      <DebugSection title="Eliminated" count={arb.eliminations.length} nested>
        {#each arb.eliminations as el (el.candidateBidName + el.reason)}
          <div class="text-[10px] text-text-muted leading-tight">
            <span class="text-red-400/60">{el.candidateBidName}</span>
            <span class="ml-0.5">— {el.reason}</span>
          </div>
        {/each}
      </DebugSection>
    {/if}

    <!-- WhyNot — collapsed by default -->
    {#if tp?.whyNot && tp.whyNot.length > 0}
      <DebugSection title="Why not these?" count={tp.whyNot.length} nested>
        {#each tp.whyNot as wn (wn.call.type + (wn.call.type === 'bid' ? wn.call.level + wn.call.strain : ''))}
          <div class="text-[10px] leading-tight">
            <span class="text-yellow-400">{fmtCall(wn.call)}</span>
            <span class="text-text-muted ml-0.5">— eliminated at {wn.eliminationStage}</span>
            {#if wn.familyRelation}
              <span class="text-purple-300 ml-0.5">({wn.familyRelation.kind})</span>
            {/if}
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
