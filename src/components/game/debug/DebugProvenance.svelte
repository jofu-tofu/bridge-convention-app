<script lang="ts">
  import type { DecisionProvenance } from "../../../core/contracts/provenance";
  import { fmtCall, truncate } from "./debug-helpers";
  import DebugSection from "./DebugSection.svelte";

  interface Props {
    provenance: DecisionProvenance | null;
  }

  let { provenance }: Props = $props();
</script>

<DebugSection
  title="Provenance"
  preview={provenance ? `${provenance.transforms.length} transforms, ${provenance.applicability.evaluatedConditions.length} conditions, ${provenance.encoding.length} encoders` : null}
>
  {#if provenance}
    {@const prov = provenance}

    <!-- Transforms -->
    {#if prov.transforms.length > 0}
      <DebugSection title="Transforms" count={prov.transforms.length} nested>
        {#each prov.transforms as tr (tr.transformId)}
          <div class="text-[10px] leading-tight">
            <span class="text-orange-300">{tr.kind}</span>
            <span class="text-text-muted ml-0.5">{tr.targetId} — {tr.reason}</span>
          </div>
        {/each}
      </DebugSection>
    {/if}

    <!-- Applicability -->
    {#if prov.applicability.evaluatedConditions.length > 0}
      <DebugSection
        title="Applicability"
        count={prov.applicability.evaluatedConditions.length}
        preview="{prov.applicability.evaluatedConditions.filter(c => c.satisfied).length}/{prov.applicability.evaluatedConditions.length} pass"
        nested
      >
        {#each prov.applicability.evaluatedConditions as cond, i (i)}
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

    <!-- Encoding -->
    {#if prov.encoding.length > 0}
      <DebugSection title="Encoding" count={prov.encoding.length} nested>
        {#each prov.encoding as enc, i (i)}
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
    {#if prov.arbitration.length > 0}
      <DebugSection title="Ranking" count={prov.arbitration.length} nested>
        {#each prov.arbitration as at (at.candidateId)}
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
