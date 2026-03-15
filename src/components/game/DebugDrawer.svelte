<!-- Full-lifecycle debug drawer — comprehensive decision model inspector.
     Surfaces all internal pipeline state: facts, machine, arbitration, provenance,
     teaching, posterior, and beliefs. Uses persistent debug log so data survives
     between turns. See also: DebugPanel.svelte (inline correct bid hint). -->
<script lang="ts">
  import { Seat, Suit } from "../../engine/types";
  import type { Call, Card } from "../../engine/types";
  import { getGameStore, getAppStore } from "../../stores/context";
  import { calculateHcp } from "../../engine/hand-evaluator";
  import { formatCall, SUIT_SYMBOLS } from "../../core/display/format";
  import { sortCards } from "../../core/display/sort-cards";
  import type { DebugSnapshot } from "../../stores/bidding.svelte";
  import type { BidFeedback } from "../../stores/game.svelte";

  interface Props {
    open: boolean;
  }

  let { open }: Props = $props();

  const gameStore = getGameStore();
  const appStore = getAppStore();

  const ALL_SEATS = [Seat.North, Seat.East, Seat.South, Seat.West] as const;

  // ─── Reactive debug data ─────────────────────────────────────
  // Live snapshot: populated only when it's the user's turn during BIDDING
  let liveSnap = $state.raw<DebugSnapshot | null>(null);

  $effect(() => {
    if (gameStore.phase === "BIDDING") {
      liveSnap = gameStore.getDebugSnapshot();
    } else {
      liveSnap = null;
    }
  });

  // The "active" snapshot: live data when available, otherwise the latest log entry's snapshot
  const debugSnap = $derived.by<DebugSnapshot | null>(() => {
    if (liveSnap?.expectedBid) return liveSnap;
    const log = gameStore.debugLog;
    if (log.length > 0) return log[log.length - 1]!.snapshot;
    return liveSnap;
  });

  // The "active" feedback: live feedback when available, otherwise from latest log entry
  const feedback = $derived.by<BidFeedback | null>(() => {
    const live = gameStore.bidFeedback;
    if (live) return live;
    const log = gameStore.debugLog;
    if (log.length > 0) return log[log.length - 1]!.feedback;
    return null;
  });

  // ─── Helpers ─────────────────────────────────────────────────
  function fmtCall(call: Call): string {
    return formatCall(call);
  }

  function formatSuitCards(cards: readonly Card[], suit: Suit): string {
    const sorted = sortCards([...cards]);
    return sorted
      .filter((c) => c.suit === suit)
      .map((c) => c.rank)
      .join("");
  }

  function fmtFactValue(v: number | boolean | string): string {
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
    return String(v);
  }

  function truncate(s: string, max: number): string {
    return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
  }
</script>

<aside
  class="h-full shrink-0 bg-bg-elevated border-l border-border-subtle shadow-2xl overflow-y-auto font-mono text-xs text-text-secondary transition-[width] duration-200 ease-in-out {open
    ? 'w-[420px]'
    : 'w-0 overflow-hidden'}"
  aria-label="Debug drawer"
  inert={!open}
>
  <!-- Header -->
  <div
    class="sticky top-0 bg-bg-elevated border-b border-border-subtle px-3 py-2 flex items-center justify-between z-10 min-w-[420px]"
  >
    <span class="text-text-primary font-semibold text-sm">Debug Console</span>
    <button
      class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer"
      onclick={() => appStore.toggleDebugPanel()}
      aria-label="Close debug panel"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
      </svg>
    </button>
  </div>

  <!-- Engine status bar -->
  {#if appStore.engineStatus}
    <div
      class="px-3 py-1.5 text-xs font-mono border-b border-border-subtle {appStore.engineStatus.includes('UNREACHABLE') ? 'bg-red-900/80 text-red-200' : 'bg-green-900/80 text-green-200'}"
    >
      {appStore.engineStatus}
    </div>
  {/if}

  <div class="p-3 flex flex-col gap-1 min-w-[420px]">

    <!-- ═══════════════════════════════════════════════════════════
         1. SUGGESTED BID
         ═══════════════════════════════════════════════════════════ -->
    <details open>
      <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">Suggested Bid</summary>
      <div class="pl-2 py-1 flex flex-col gap-1">
        {#if debugSnap?.expectedBid}
          {@const bid = debugSnap.expectedBid}
          <div class="flex items-baseline gap-2">
            <span class="text-lg font-bold text-green-300">{fmtCall(bid.call)}</span>
            {#if bid.meaning}
              <span class="text-yellow-300">{bid.meaning}</span>
            {/if}
          </div>
          <div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
            <span class="text-text-muted">rule</span>
            <span class="text-text-primary">{bid.ruleName ?? "—"}</span>
            <span class="text-text-muted">explanation</span>
            <span class="text-text-primary">{bid.explanation}</span>
            {#if bid.handSummary}
              <span class="text-text-muted">hand</span>
              <span class="text-text-primary">{bid.handSummary}</span>
            {/if}
            {#if bid.evaluationTrace}
              <span class="text-text-muted">convention</span>
              <span class="text-text-primary">{bid.evaluationTrace.conventionId}</span>
              <span class="text-text-muted">candidates</span>
              <span class="text-text-primary">{bid.evaluationTrace.candidateCount}</span>
              {#if bid.evaluationTrace.posteriorSampleCount}
                <span class="text-text-muted">posterior</span>
                <span class="text-text-primary">{bid.evaluationTrace.posteriorSampleCount} samples, {((bid.evaluationTrace.posteriorConfidence ?? 0) * 100).toFixed(0)}% conf</span>
              {/if}
            {/if}
          </div>
        {:else}
          <span class="text-yellow-300/50 italic">No convention bid (pass)</span>
        {/if}
      </div>
    </details>

    <!-- ═══════════════════════════════════════════════════════════
         2. HAND FACTS
         ═══════════════════════════════════════════════════════════ -->
    <details>
      <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">
        Hand Facts
        {#if debugSnap?.facts}<span class="text-text-muted font-normal">({debugSnap.facts.facts.size})</span>{/if}
      </summary>
      <div class="pl-2 py-1">
        {#if debugSnap?.facts}
          <table class="w-full">
            <tbody>
              {#each [...debugSnap.facts.facts.entries()].sort(([a], [b]) => a.localeCompare(b)) as [id, fv] (id)}
                <tr class="border-b border-border-subtle/30">
                  <td class="py-0.5 pr-2 text-text-muted max-w-[180px] truncate" title={id}>{id}</td>
                  <td class="py-0.5 text-text-primary font-semibold {typeof fv.value === 'boolean' ? (fv.value ? 'text-green-400' : 'text-red-400') : ''}">{fmtFactValue(fv.value)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <div class="text-text-muted italic">No facts (not user's turn or no strategy)</div>
        {/if}
      </div>
    </details>

    <!-- ═══════════════════════════════════════════════════════════
         3. CONVENTION MACHINE STATE
         ═══════════════════════════════════════════════════════════ -->
    <details>
      <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">Convention Machine</summary>
      <div class="pl-2 py-1">
        {#if debugSnap?.machineSnapshot}
          {@const ms = debugSnap.machineSnapshot}
          <div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
            <span class="text-text-muted">state</span>
            <span class="text-cyan-300 font-bold">{ms.currentStateId}</span>
            <span class="text-text-muted">forcing</span>
            <span class="text-text-primary {ms.registers.forcingState === 'game-forcing' ? 'text-red-300 font-bold' : ms.registers.forcingState === 'forcing-one-round' ? 'text-yellow-300' : ''}">{ms.registers.forcingState}</span>
            <span class="text-text-muted">obligation</span>
            <span class="text-text-primary">{ms.registers.obligation.kind} ({ms.registers.obligation.obligatedSide})</span>
            <span class="text-text-muted">strain</span>
            <span class="text-text-primary">{ms.registers.agreedStrain.type}{ms.registers.agreedStrain.suit ? ` (${ms.registers.agreedStrain.suit})` : ""}{ms.registers.agreedStrain.confidence ? ` [${ms.registers.agreedStrain.confidence}]` : ""}</span>
            <span class="text-text-muted">competition</span>
            <span class="text-text-primary">{ms.registers.competitionMode}</span>
            <span class="text-text-muted">captain</span>
            <span class="text-text-primary">{ms.registers.captain}</span>
          </div>
          {#if Object.keys(ms.registers.systemCapabilities).length > 0}
            <div class="mt-1">
              <span class="text-text-muted">capabilities:</span>
              {#each Object.entries(ms.registers.systemCapabilities) as [k, v] (k)}
                <span class="ml-1 text-purple-300">{k}={v}</span>
              {/each}
            </div>
          {/if}
          <div class="mt-1">
            <span class="text-text-muted">active groups:</span>
            {#each ms.activeSurfaceGroupIds as gid (gid)}
              <span class="ml-1 px-1 bg-cyan-900/50 text-cyan-200 rounded">{gid}</span>
            {/each}
          </div>
          {#if ms.stateHistory.length > 0}
            <div class="mt-1">
              <span class="text-text-muted">state history:</span>
              <span class="text-text-primary ml-1">{ms.stateHistory.join(" → ")}</span>
            </div>
          {/if}
          {#if ms.transitionHistory.length > 0}
            <div class="mt-0.5">
              <span class="text-text-muted">transitions:</span>
              <span class="text-text-primary ml-1">{ms.transitionHistory.join(", ")}</span>
            </div>
          {/if}
          {#if ms.submachineStack.length > 0}
            <div class="mt-0.5">
              <span class="text-text-muted">submachine stack:</span>
              {#each ms.submachineStack as frame (frame.parentMachineId)}
                <span class="ml-1 text-orange-300">{frame.parentMachineId}→{frame.returnStateId}</span>
              {/each}
            </div>
          {/if}
          {#if ms.diagnostics.length > 0}
            <div class="mt-1 border-t border-border-subtle/30 pt-1">
              {#each ms.diagnostics as d, i (i)}
                <div class="{d.level === 'warn' ? 'text-yellow-400' : d.level === 'error' ? 'text-red-400' : 'text-text-muted'}">
                  [{d.level}] {d.moduleId ? `${d.moduleId}: ` : ""}{d.message}
                </div>
              {/each}
            </div>
          {/if}
          {#if ms.handoffTraces.length > 0}
            <div class="mt-1 border-t border-border-subtle/30 pt-1">
              <span class="text-text-muted">handoffs:</span>
              {#each ms.handoffTraces as h, i (i)}
                <div class="text-orange-300">{h.fromModuleId} → {h.toModuleId}: {h.reason}</div>
              {/each}
            </div>
          {/if}
        {:else}
          <div class="text-text-muted italic">No machine state</div>
        {/if}
      </div>
    </details>

    <!-- ═══════════════════════════════════════════════════════════
         4. PIPELINE — unified candidate view (merged arbitration + teaching projection)
         ═══════════════════════════════════════════════════════════ -->
    <details>
      <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">
        Pipeline
        {#if debugSnap?.arbitration}
          {@const arb = debugSnap.arbitration}
          <span class="text-text-muted font-normal">
            ({arb.truthSet.length + arb.acceptableSet.length} candidates, {arb.eliminations.length} eliminated)
          </span>
        {/if}
      </summary>
      <div class="pl-2 py-1">
        {#if debugSnap?.arbitration}
          {@const arb = debugSnap.arbitration}
          {@const tp = debugSnap.teachingProjection}

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

    <!-- ═══════════════════════════════════════════════════════════
         5. PROVENANCE (audit trail — collapsed by default)
         ═══════════════════════════════════════════════════════════ -->
    <details>
      <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">
        Provenance
        {#if debugSnap?.provenance}
          <span class="text-text-muted font-normal">(trace)</span>
        {/if}
      </summary>
      <div class="pl-2 py-1">
        {#if debugSnap?.provenance}
          {@const prov = debugSnap.provenance}

          <!-- Encoding traces -->
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

          <!-- Ranking traces -->
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

          <!-- Applicability evidence -->
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

          <!-- Transform and other traces -->
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
        {:else}
          <div class="text-text-muted italic">No provenance data</div>
        {/if}
      </div>
    </details>

    <!-- ═══════════════════════════════════════════════════════════
         6. TEACHING (grade + feedback after bidding)
         ═══════════════════════════════════════════════════════════ -->
    <details>
      <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">
        Teaching
        {#if feedback}<span class="text-text-muted font-normal">(grade: {feedback.grade})</span>{/if}
      </summary>
      <div class="pl-2 py-1">
        {#if feedback}
          <div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 mb-2">
            <span class="text-text-muted">grade</span>
            <span class="font-bold {feedback.grade === 'correct' ? 'text-green-400' : feedback.grade === 'correct-not-preferred' ? 'text-green-300' : feedback.grade === 'acceptable' ? 'text-teal-300' : feedback.grade === 'near-miss' ? 'text-yellow-400' : 'text-red-400'}">{feedback.grade}</span>
            <span class="text-text-muted">user bid</span>
            <span class="text-text-primary">{fmtCall(feedback.userCall)}</span>
            {#if feedback.expectedResult}
              <span class="text-text-muted">expected</span>
              <span class="text-green-300">{fmtCall(feedback.expectedResult.call)}</span>
            {/if}
          </div>

          {#if feedback.teachingResolution}
            {@const tr = feedback.teachingResolution}
            <div class="mb-1.5">
              <div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                <span class="text-text-muted">type</span>
                <span class="text-text-primary">{tr.gradingType}</span>
                <span class="text-text-muted">ambiguity</span>
                <span class="text-text-primary">{tr.ambiguityScore}</span>
              </div>
              {#if tr.acceptableBids.length > 0}
                <div class="mt-1">
                  <span class="text-text-muted">also acceptable:</span>
                  {#each tr.acceptableBids as ab (ab.bidName)}
                    <div class="pl-2">
                      <span class="text-teal-300">{fmtCall(ab.call)}</span>
                      <span class="text-text-primary ml-1">{ab.meaning}</span>
                      <span class="text-text-muted ml-1">({ab.tier}{ab.fullCredit ? ", full credit" : ""})</span>
                    </div>
                  {/each}
                </div>
              {/if}
              {#if tr.nearMissCalls && tr.nearMissCalls.length > 0}
                <div class="mt-1">
                  <span class="text-text-muted">near-misses:</span>
                  {#each tr.nearMissCalls as nm (nm.call.type + (nm.call.type === 'bid' ? nm.call.level + nm.call.strain : ''))}
                    <div class="pl-2">
                      <span class="text-yellow-400">{fmtCall(nm.call)}</span>
                      <span class="text-text-muted ml-1">— {nm.reason}</span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        {:else}
          <div class="text-text-muted italic">No feedback yet (bid to see grading)</div>
        {/if}
      </div>
    </details>

    <!-- ═══════════════════════════════════════════════════════════
         8. BID LOG (persistent turn-by-turn debug trail)
         ═══════════════════════════════════════════════════════════ -->
    <details>
      <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">
        Bid Log
        {#if gameStore.debugLog.length > 0}
          <span class="text-text-muted font-normal">({gameStore.debugLog.length} entries)</span>
        {/if}
      </summary>
      <div class="pl-2 py-1">
        {#if gameStore.debugLog.length === 0}
          <div class="text-text-muted italic">No bids yet</div>
        {:else}
          {#each gameStore.debugLog as entry (entry.turnIndex)}
            <div class="mb-2 border-l-2 pl-2 {entry.feedback ? (entry.feedback.grade === 'correct' || entry.feedback.grade === 'correct-not-preferred' || entry.feedback.grade === 'acceptable' ? 'border-green-500/60' : entry.feedback.grade === 'near-miss' ? 'border-yellow-500/60' : 'border-red-500/60') : 'border-border-subtle'}">
              <div class="flex items-baseline gap-1.5">
                <span class="text-text-muted">#{entry.turnIndex}</span>
                <span class="text-text-primary font-semibold">{entry.seat}</span>
                {#if entry.call}
                  <span class="font-bold {entry.feedback?.grade === 'correct' ? 'text-green-300' : entry.feedback?.grade === 'incorrect' ? 'text-red-400' : 'text-text-primary'}">{fmtCall(entry.call)}</span>
                {/if}
                {#if entry.feedback}
                  <span class="text-xs px-1 rounded {entry.feedback.grade === 'correct' ? 'bg-green-900/50 text-green-300' : entry.feedback.grade === 'incorrect' ? 'bg-red-900/50 text-red-300' : entry.feedback.grade === 'near-miss' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-teal-900/50 text-teal-300'}">{entry.feedback.grade}</span>
                {/if}
              </div>
              {#if entry.snapshot.expectedBid}
                <div class="text-text-muted">
                  expected: <span class="text-green-300">{fmtCall(entry.snapshot.expectedBid.call)}</span>
                  {#if entry.snapshot.expectedBid.meaning}
                    <span class="text-yellow-300 ml-1">{entry.snapshot.expectedBid.meaning}</span>
                  {/if}
                </div>
              {/if}
              {#if entry.snapshot.machineSnapshot}
                <div class="text-text-muted">
                  state: <span class="text-cyan-300">{entry.snapshot.machineSnapshot.currentStateId}</span>
                  | forcing: <span class="text-text-primary">{entry.snapshot.machineSnapshot.registers.forcingState}</span>
                </div>
              {/if}
              {#if entry.feedback?.teachingResolution}
                {@const tr = entry.feedback.teachingResolution}
                {#if tr.acceptableBids.length > 0}
                  <div class="text-text-muted">
                    also ok: {tr.acceptableBids.map(ab => fmtCall(ab.call)).join(", ")}
                  </div>
                {/if}
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </details>

    <!-- ═══════════════════════════════════════════════════════════
         9. POSTERIOR
         ═══════════════════════════════════════════════════════════ -->
    <details>
      <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">
        Posterior
        {#if debugSnap?.posteriorSummary}
          <span class="text-text-muted font-normal">({debugSnap.posteriorSummary.sampleCount} samples)</span>
        {/if}
      </summary>
      <div class="pl-2 py-1">
        {#if debugSnap?.posteriorSummary}
          {@const ps = debugSnap.posteriorSummary}
          <div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 mb-1">
            <span class="text-text-muted">samples</span>
            <span class="text-text-primary">{ps.sampleCount}</span>
            <span class="text-text-muted">confidence</span>
            <span class="text-text-primary">{(ps.confidence * 100).toFixed(1)}%</span>
          </div>
          {#if ps.factValues.length > 0}
            <div>
              <span class="text-text-muted font-semibold">Fact Values:</span>
              {#each ps.factValues as fv (fv.factId + fv.seatId)}
                <div class="pl-2">
                  <span class="text-text-primary">{fv.factId}</span>
                  <span class="text-text-muted ml-1">({fv.seatId})</span>
                  <span class="text-cyan-300 ml-1">{fv.expectedValue.toFixed(3)}</span>
                  <span class="text-text-muted ml-1">conf:{(fv.confidence * 100).toFixed(0)}%</span>
                </div>
              {/each}
            </div>
          {/if}
        {:else}
          <div class="text-text-muted italic">No posterior data (not wired or no samples)</div>
        {/if}
      </div>
    </details>

    <!-- ═══════════════════════════════════════════════════════════
         9. PUBLIC BELIEFS
         ═══════════════════════════════════════════════════════════ -->
    <details>
      <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">
        Public Beliefs
        {#if gameStore.publicBeliefState.annotations.length > 0}
          <span class="text-text-muted font-normal">({gameStore.publicBeliefState.annotations.length} annotations)</span>
        {/if}
      </summary>
      <div class="pl-2 py-1">
        <!-- Per-seat beliefs -->
        {#each ALL_SEATS as seat (seat)}
          {@const inf = gameStore.publicBeliefState.beliefs[seat]}
          <div class="mb-1.5">
            <span class="text-text-primary font-semibold">{seat}</span>
            <span class="text-text-muted ml-1">HCP: {inf.hcpRange.min}-{inf.hcpRange.max}</span>
            {#if inf.isBalanced !== undefined}
              <span class="text-text-muted ml-1">Bal: {inf.isBalanced ? "Y" : "N"}</span>
            {/if}
            <div class="pl-2">
              {#each [{ suit: Suit.Spades, sym: "\u2660" }, { suit: Suit.Hearts, sym: "\u2665" }, { suit: Suit.Diamonds, sym: "\u2666" }, { suit: Suit.Clubs, sym: "\u2663" }] as { suit, sym } (suit)}
                {@const sl = inf.suitLengths[suit]}
                <span class="mr-2 {suit === Suit.Hearts || suit === Suit.Diamonds ? 'text-red-400' : 'text-text-primary'}">{sym}{sl.min}-{sl.max}</span>
              {/each}
            </div>
          </div>
        {/each}
        <!-- Annotations -->
        {#if gameStore.publicBeliefState.annotations.length > 0}
          <div class="border-t border-border-subtle/30 pt-1 mt-1">
            <span class="text-text-muted font-semibold">Annotations:</span>
            {#each gameStore.publicBeliefState.annotations as ann, i (i)}
              <div class="pl-2">
                <span class="text-text-primary">{ann.seat}:</span>
                <span class="text-cyan-300 ml-1">{fmtCall(ann.call)}</span>
                <span class="text-text-muted ml-1">{ann.meaning}</span>
                {#if ann.conventionId}
                  <span class="text-purple-300 ml-1">[{ann.conventionId}]</span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </details>

    <!-- ═══════════════════════════════════════════════════════════
         10. DEAL INFO
         ═══════════════════════════════════════════════════════════ -->
    <details>
      <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">Deal Info</summary>
      <div class="pl-2 py-1 flex flex-col gap-0.5">
        <div>
          Convention: <span class="text-text-primary">{appStore.selectedConvention?.name ?? "None"}</span>
          <span class="text-text-muted">({appStore.selectedConvention?.id ?? "\u2014"})</span>
        </div>
        {#if appStore.devSeed !== null}
          <div>Seed: <span class="text-text-primary">{appStore.devSeed}</span></div>
        {/if}
        <div>Dealer: <span class="text-text-primary">{gameStore.deal?.dealer ?? "\u2014"}</span></div>
        <div>Vulnerability: <span class="text-text-primary">{gameStore.deal?.vulnerability ?? "\u2014"}</span></div>
        <div>Phase: <span class="text-text-primary">{gameStore.phase}</span></div>
      </div>
    </details>

    <!-- ═══════════════════════════════════════════════════════════
         11. ALL HANDS
         ═══════════════════════════════════════════════════════════ -->
    <details>
      <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">All Hands</summary>
      <div class="pl-2 py-1">
        {#if gameStore.deal}
          {#each ALL_SEATS as seat (seat)}
            <div class="mb-2">
              <div class="font-semibold text-text-primary">
                {seat}
                <span class="text-text-muted font-normal">({calculateHcp(gameStore.deal.hands[seat])} HCP)</span>
              </div>
              <div class="pl-2">
                {#each [{ suit: Suit.Spades, sym: "\u2660" }, { suit: Suit.Hearts, sym: "\u2665" }, { suit: Suit.Diamonds, sym: "\u2666" }, { suit: Suit.Clubs, sym: "\u2663" }] as { suit, sym } (suit)}
                  <div>
                    <span class={suit === Suit.Hearts || suit === Suit.Diamonds ? "text-red-400" : "text-text-primary"}>{sym}</span>
                    {formatSuitCards(gameStore.deal.hands[seat].cards, suit)}
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </details>

    <!-- ═══════════════════════════════════════════════════════════
         PLAY LOG (play-phase only)
         ═══════════════════════════════════════════════════════════ -->
    <details>
      <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">Play Log</summary>
      <div class="pl-2 py-1">
        {#if gameStore.playLog.length === 0}
          <div class="text-text-muted italic">No plays yet</div>
        {:else}
          {#each gameStore.playLog as entry, i (entry.seat + '-' + entry.card.suit + entry.card.rank)}
            {#if i === 0 || entry.trickIndex !== gameStore.playLog[i - 1]?.trickIndex}
              <div class="text-text-primary font-semibold mt-1">Trick {entry.trickIndex + 1}</div>
            {/if}
            <div class="pl-2">
              <span class="text-text-primary">{entry.seat}:</span>
              {SUIT_SYMBOLS[entry.card.suit]}{entry.card.rank}
              <span class="text-text-muted">({entry.reason})</span>
            </div>
          {/each}
        {/if}
      </div>
    </details>
  </div>
</aside>
