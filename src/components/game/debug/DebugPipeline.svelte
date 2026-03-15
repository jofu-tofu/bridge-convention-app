<script lang="ts">
  import type { ArbitrationResult } from "../../../core/contracts/module-surface";
  import type { TeachingProjection } from "../../../core/contracts";
  import { fmtCall } from "./debug-helpers";

  interface Props {
    arbitration: ArbitrationResult | null;
    teachingProjection: TeachingProjection | null;
  }

  let { arbitration, teachingProjection }: Props = $props();
</script>

<details>
  <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">
    Pipeline
    {#if arbitration}
      {@const arb = arbitration}
      <span class="text-text-muted font-normal">
        ({arb.truthSet.length + arb.acceptableSet.length} candidates, {arb.eliminations.length} eliminated)
      </span>
    {/if}
  </summary>
  <div class="pl-2 py-1">
    {#if arbitration}
      {@const arb = arbitration}
      {@const tp = teachingProjection}

      <!-- Winner -->
      {#if arb.selected}
        <div class="mb-2 p-1.5 bg-green-900/20 rounded border border-green-500/30">
          <div class="flex items-baseline gap-1.5">
            <span class="text-lg font-bold text-green-300">{fmtCall(arb.selected.call)}</span>
            <span class="text-green-200">{arb.selected.proposal.teachingLabel ?? arb.selected.proposal.meaningId}</span>
          </div>
          <div class="text-text-muted text-[10px] mt-0.5">
            module: {arb.selected.proposal.moduleId} | band: {arb.selected.proposal.ranking.recommendationBand} | spec: {arb.selected.proposal.ranking.specificity}
          </div>
        </div>
      {:else}
        <div class="mb-2 p-1.5 bg-yellow-900/20 rounded border border-yellow-500/30 text-yellow-300">
          No candidate matched — pass
        </div>
      {/if}

      <!-- All candidates: truth set (matched) -->
      {#if arb.truthSet.length > 0}
        <div class="mb-1.5">
          <div class="text-text-muted font-semibold mb-0.5">Matched ({arb.truthSet.length}):</div>
          {#each arb.truthSet as ep (ep.proposal.meaningId)}
            <div class="pl-2 mb-1 border-l-2 border-green-500/40 pl-2">
              <div class="flex items-baseline gap-1">
                <span class="text-green-300 font-bold">{fmtCall(ep.call)}</span>
                <span class="text-text-primary">{ep.proposal.teachingLabel ?? ep.proposal.meaningId}</span>
              </div>
              <!-- Show satisfied clauses compactly -->
              <div class="text-[10px] text-text-muted">
                {#each ep.proposal.clauses as clause (clause.factId + clause.operator)}
                  <span class="{clause.satisfied ? 'text-green-400/70' : 'text-red-400/70'}">{clause.satisfied ? '+' : '-'}{clause.description}</span><span class="mx-0.5">|</span>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Other candidates: acceptable set (didn't match this hand) -->
      {#if arb.acceptableSet.length > 0}
        <div class="mb-1.5">
          <div class="text-text-muted font-semibold mb-0.5">Not this hand ({arb.acceptableSet.length}):</div>
          {#each arb.acceptableSet as ep (ep.proposal.meaningId)}
            <div class="pl-2 mb-1 border-l-2 border-text-muted/30 pl-2">
              <div class="flex items-baseline gap-1">
                <span class="text-text-muted font-bold">{fmtCall(ep.call)}</span>
                <span class="text-text-muted">{ep.proposal.teachingLabel ?? ep.proposal.meaningId}</span>
              </div>
              <!-- Show which clauses failed with observed vs needed values -->
              <div class="text-[10px]">
                {#each ep.proposal.clauses.filter(c => !c.satisfied) as clause (clause.factId + clause.operator)}
                  <div class="text-red-400/70 pl-1">
                    {clause.description}
                    {#if clause.observedValue !== undefined}
                      <span class="text-text-muted">(have: {String(clause.observedValue)}, need: {typeof clause.value === 'object' && clause.value !== null && 'min' in clause.value ? `${clause.value.min}-${clause.value.max}` : String(clause.value)})</span>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Eliminated: didn't even make it through gates -->
      {#if arb.eliminations.length > 0}
        <div class="mb-1.5">
          <div class="text-text-muted font-semibold mb-0.5">Eliminated ({arb.eliminations.length}):</div>
          {#each arb.eliminations as el (el.candidateBidName + el.reason)}
            <div class="pl-2 text-text-muted">
              <span class="text-red-400/60">{el.candidateBidName}</span>
              <span class="ml-1">— {el.reason}</span>
            </div>
          {/each}
        </div>
      {/if}

      <!-- WhyNot (from teaching projection) -->
      {#if tp?.whyNot && tp.whyNot.length > 0}
        <div class="mb-1.5">
          <div class="text-text-muted font-semibold mb-0.5">Why not these?</div>
          {#each tp.whyNot as wn (wn.call.type + (wn.call.type === 'bid' ? wn.call.level + wn.call.strain : ''))}
            <div class="pl-2 mb-0.5">
              <span class="text-yellow-400">{fmtCall(wn.call)}</span>
              <span class="text-text-muted ml-1">— eliminated at {wn.eliminationStage}</span>
              {#if wn.familyRelation}
                <span class="text-purple-300 ml-1">({wn.familyRelation.kind})</span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- Hand space summary (from teaching projection) -->
      {#if tp?.handSpace}
        <div class="mt-1 pt-1 border-t border-border-subtle/30">
          <span class="text-text-muted font-semibold">Convention expects:</span>
          <span class="text-text-primary ml-1">{tp.handSpace.hcpRange.min}-{tp.handSpace.hcpRange.max} HCP, {tp.handSpace.shapeDescription}</span>
          {#if tp.handSpace.partnerSummary}
            <div class="text-text-muted pl-2">partner: {tp.handSpace.partnerSummary}</div>
          {/if}
        </div>
      {/if}
    {:else}
      <div class="text-text-muted italic">No pipeline data</div>
    {/if}
  </div>
</details>
