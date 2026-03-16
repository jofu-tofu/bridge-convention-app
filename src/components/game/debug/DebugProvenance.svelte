<script lang="ts">
  import type { DecisionProvenance } from "../../../core/contracts/provenance";
  import { fmtCall, truncate } from "./debug-helpers";

  interface Props {
    provenance: DecisionProvenance | null;
  }

  let { provenance }: Props = $props();
</script>

<details>
  <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">
    Provenance
    {#if provenance}
      <span class="text-text-muted font-normal">(trace)</span>
    {/if}
  </summary>
  <div class="pl-2 py-1">
    {#if provenance}
      {@const prov = provenance}

      <!-- Transforms (surface composition: suppress/remap/inject) -->
      {#if prov.transforms.length > 0}
        <div class="mb-1.5">
          <span class="text-text-muted font-semibold">Transforms:</span>
          {#each prov.transforms as tr (tr.transformId)}
            <div class="pl-2">
              <span class="text-orange-300">{tr.kind}</span>
              <span class="text-text-muted ml-1">{tr.targetId} — {tr.reason}</span>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Applicability (clause evaluation against facts) -->
      {#if prov.applicability.evaluatedConditions.length > 0}
        <div class="mb-1.5">
          <span class="text-text-muted font-semibold">Applicability:</span>
          {#each prov.applicability.evaluatedConditions as cond, i (i)}
            <div class="pl-2">
              <span class={cond.satisfied ? "text-green-400" : "text-red-400"}>{cond.satisfied ? "+" : "-"}</span>
              <span class="text-text-primary ml-1">{cond.conditionId ?? ""}</span>
              {#if cond.observedValue !== undefined}
                <span class="text-text-muted ml-1">(got: {String(cond.observedValue)}{cond.threshold !== undefined ? `, need: ${String(cond.threshold)}` : ""})</span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- Encoding (how meanings became concrete calls) -->
      {#if prov.encoding.length > 0}
        <div class="mb-1.5">
          <span class="text-text-muted font-semibold">Encoding:</span>
          {#each prov.encoding as enc, i (i)}
            <div class="pl-2 mt-0.5">
              <span class="text-purple-300">{enc.encoderKind}</span>
              <span class="text-text-muted ml-1">({enc.encoderId})</span>
              {#if enc.chosenCall}
                <span class="text-green-300 ml-1">→ {fmtCall(enc.chosenCall)}</span>
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
        </div>
      {/if}

      <!-- Ranking (arbitration: truth set, ranking inputs) -->
      {#if prov.arbitration.length > 0}
        <div class="mb-1.5">
          <span class="text-text-muted font-semibold">Ranking:</span>
          {#each prov.arbitration as at (at.candidateId)}
            <div class="pl-2">
              <span class={at.truthSetMember ? "text-green-300" : "text-text-muted"}>{truncate(at.candidateId, 30)}</span>
              <span class="text-text-muted ml-1">band:{at.rankingInputs.recommendationBand} spec:{at.rankingInputs.specificity} mod:{at.rankingInputs.modulePrecedence}</span>
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      <div class="text-text-muted italic">No provenance data</div>
    {/if}
  </div>
</details>
