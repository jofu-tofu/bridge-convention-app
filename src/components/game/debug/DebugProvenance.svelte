<script lang="ts">
  import type { PipelineResult } from "../../../conventions";
  import { fmtCall, truncate } from "./debug-helpers";
  import DebugSection from "./DebugSection.svelte";

  interface Props {
    pipelineResult: PipelineResult | null;
  }

  let { pipelineResult }: Props = $props();
</script>

<DebugSection
  title="Provenance"
  preview={pipelineResult ? `${pipelineResult.applicability.evaluatedConditions.length} conditions` : null}
>
  {#if pipelineResult}
    {@const pr = pipelineResult}

    <!-- Applicability -->
    {#if pr.applicability.evaluatedConditions.length > 0}
      <DebugSection
        title="Applicability"
        count={pr.applicability.evaluatedConditions.length}
        preview="{pr.applicability.evaluatedConditions.filter(c => c.satisfied).length}/{pr.applicability.evaluatedConditions.length} pass"
        nested
      >
        {#each pr.applicability.evaluatedConditions as cond, i (i)}
          <div class="text-[10px] leading-tight">
            <span class={cond.satisfied ? "text-green-400" : "text-red-400"}>{cond.satisfied ? "+" : "-"}</span>
            <span class="text-text-primary ml-0.5">{cond.conditionId ?? ""}</span>
            {#if cond.observedValue !== undefined}
              <span class="text-text-muted ml-0.5">(got: {String(cond.observedValue)}{cond.threshold !== undefined ? `, need: ${String(cond.threshold)}` : ""})</span>
            {/if}
          </div>
        {/each}
      </DebugSection>
    {/if}

    <!-- Encoding (from carriers) -->
    {@const encodingTraces = [...pr.truthSet, ...pr.acceptableSet, ...pr.eliminated].map(c => c.traces.encoding)}
    {#if encodingTraces.length > 0}
      <DebugSection title="Encoding" count={encodingTraces.length} nested>
        {#each encodingTraces as enc, i (i)}
          <div class="text-[10px] leading-tight mb-0.5">
            <span class="text-purple-300">{enc.encoderKind}</span>
            <span class="text-text-muted ml-0.5">({enc.encoderId})</span>
            {#if enc.chosenCall}
              <span class="text-green-300 ml-0.5">→ {fmtCall(enc.chosenCall)}</span>
            {/if}
            {#if enc.blockedCalls.length > 0}
              <div class="pl-2">
                {#each enc.blockedCalls as bc (bc.call.type + (bc.call.type === 'bid' ? bc.call.level + bc.call.strain : ''))}
                  <span class="text-red-400">{fmtCall(bc.call)} blocked: {bc.reason}</span>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </DebugSection>
    {/if}

    <!-- Ranking -->
    {#if pr.arbitration.length > 0}
      <DebugSection title="Ranking" count={pr.arbitration.length} nested>
        {#each pr.arbitration as at (at.candidateId)}
          <div class="text-[10px] leading-tight">
            <span class={at.truthSetMember ? "text-green-300" : "text-text-muted"}>{truncate(at.candidateId, 30)}</span>
            <span class="text-text-muted ml-0.5">band:{at.rankingInputs.recommendationBand} spec:{at.rankingInputs.specificity} mod:{at.rankingInputs.modulePrecedence}</span>
          </div>
        {/each}
      </DebugSection>
    {/if}
  {:else}
    <div class="text-text-muted italic text-[10px]">No provenance data</div>
  {/if}
</DebugSection>
