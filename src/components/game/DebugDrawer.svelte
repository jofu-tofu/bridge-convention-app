<!-- Full-lifecycle debug drawer — comprehensive decision model inspector.
     Surfaces all internal pipeline state: facts, machine, arbitration, provenance,
     teaching, posterior, and beliefs. Uses persistent debug log so data survives
     between turns.

     Layout: At-a-glance summary (always visible) + 3 collapsible groups:
       1. Context (deal info, hands)
       2. Decision Pipeline (machine, facts, provenance, pipeline, posterior, suggested bid)
       3. Feedback & History (teaching, beliefs, bid log, play log) -->
<script lang="ts">
  import { Seat } from "../../service";
  import { getGameStore, getAppStore } from "../../stores/context";
  import type { DebugSnapshot, DebugBidFeedback } from "../../stores/game.svelte";

  import DebugAtAGlance from "./debug/DebugAtAGlance.svelte";
  import DebugDealInfo from "./debug/DebugDealInfo.svelte";
  import DebugAllHands from "./debug/DebugAllHands.svelte";
  import DebugConventionMachine from "./debug/DebugConventionMachine.svelte";
  import DebugHandFacts from "./debug/DebugHandFacts.svelte";
  import DebugProvenance from "./debug/DebugProvenance.svelte";
  import DebugPipeline from "./debug/DebugPipeline.svelte";
  import DebugPosterior from "./debug/DebugPosterior.svelte";
  import DebugSuggestedBid from "./debug/DebugSuggestedBid.svelte";
  import DebugTeaching from "./debug/DebugTeaching.svelte";
  import DebugPublicBeliefs from "./debug/DebugPublicBeliefs.svelte";
  import DebugBidLog from "./debug/DebugBidLog.svelte";
  import DebugPlayLog from "./debug/DebugPlayLog.svelte";
  interface Props {
    open: boolean;
  }

  let { open }: Props = $props();

  const gameStore = getGameStore();
  const appStore = getAppStore();

  // When debugExpanded is set (?dev=expanded), all collapsible sections start open
  const allOpen = $derived(appStore.debugExpanded);

  const ALL_SEATS = [Seat.North, Seat.East, Seat.South, Seat.West] as const;

  // ─── Phase-aware visibility ─────────────────────────────────
  const isPlayingPhase = $derived(gameStore.phase === "PLAYING");

  // ─── Pipeline view toggle ────────────────────────────────────
  type PipelineView = "current" | "last-bid";
  let pipelineView = $state<PipelineView>("current");

  // ─── Log-based debug data ────────────────────────────────────
  // All state derived from gameStore.debugLog — no separate reactive snapshots.

  // Latest snapshot (current position — last entry in log).
  const currentSnap = $derived.by<DebugSnapshot | null>(() => {
    const log = gameStore.debugLog;
    if (log.length === 0) return null;
    return log[log.length - 1]?.snapshot ?? null;
  });

  // Most recent user-bid snapshot (pipeline state when the user last bid).
  const lastBidSnap = $derived.by<DebugSnapshot | null>(() => {
    const log = gameStore.debugLog;
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i]!.kind === "user-bid") return log[i]!.snapshot ?? null;
    }
    return null;
  });

  // The active snapshot shown in the Decision Pipeline section.
  const debugSnap = $derived<DebugSnapshot | null>(
    pipelineView === "last-bid" ? lastBidSnap : currentSnap,
  );

  // Whether the toggle should be shown (only when there's a user-bid entry).
  const hasLastBid = $derived(lastBidSnap !== null);

  // Feedback: scan backwards for the most recent entry with feedback.
  const feedback = $derived.by<DebugBidFeedback | null>(() => {
    const log = gameStore.debugLog;
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i]!.feedback) return log[i]!.feedback ?? null;
    }
    return null;
  });
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
    class="sticky top-0 bg-bg-elevated border-b border-border-subtle px-3 py-1.5 flex items-center justify-between z-[var(--z-header)] min-w-[420px]"
  >
    <span class="text-text-primary font-semibold text-xs tracking-wide">DEBUG</span>
    <button
      class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer"
      onclick={() => appStore.toggleDebugPanel()}
      aria-label="Close debug panel"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
      </svg>
    </button>
  </div>

  <div class="p-2 flex flex-col gap-2 min-w-[420px]">
    <!-- At-a-glance summary — always visible, always shows current position -->
    <DebugAtAGlance snapshot={currentSnap} {feedback} phase={gameStore.phase} />

    <!-- Group 1: Context -->
    <details open={allOpen}>
      <summary class="text-[10px] font-bold uppercase tracking-widest text-text-muted cursor-pointer py-0.5 border-b border-border-subtle/30">Context</summary>
      <div class="pt-1 flex flex-col gap-0.5">
        <DebugDealInfo
          conventionName={appStore.selectedConvention?.name ?? null}
          conventionId={appStore.selectedConvention?.id ?? null}
          devSeed={appStore.devSeed}
          dealer={gameStore.biddingViewport?.dealer ?? gameStore.deal?.dealer}
          vulnerability={gameStore.biddingViewport?.vulnerability ?? gameStore.deal?.vulnerability}
          phase={gameStore.phase}
        />
        <DebugAllHands deal={gameStore.deal} allSeats={ALL_SEATS} />
      </div>
    </details>

    <!-- Group 2: Decision Pipeline (hidden during play phase) -->
    {#if !isPlayingPhase}
      <details open>
        <summary class="text-[10px] font-bold uppercase tracking-widest text-text-muted cursor-pointer py-0.5 border-b border-border-subtle/30">Decision Pipeline</summary>
        {#if hasLastBid}
          <div class="flex gap-0.5 pt-1 pb-0.5">
            <button
              class="px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer {pipelineView === 'current' ? 'bg-blue-900/60 text-blue-200' : 'bg-bg-card/40 text-text-muted hover:text-text-secondary'}"
              onclick={() => pipelineView = "current"}
            >Current</button>
            <button
              class="px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer {pipelineView === 'last-bid' ? 'bg-amber-900/60 text-amber-200' : 'bg-bg-card/40 text-text-muted hover:text-text-secondary'}"
              onclick={() => pipelineView = "last-bid"}
            >Last bid</button>
          </div>
        {/if}
        <div class="pt-1 flex flex-col gap-0.5">
          <DebugSuggestedBid expectedBid={debugSnap?.expectedBid ?? null} />
          <DebugPipeline pipelineResult={debugSnap?.pipelineResult ?? null} teachingProjection={debugSnap?.teachingProjection ?? null} />
          <DebugConventionMachine machineSnapshot={debugSnap?.machineSnapshot ?? null} />
          <DebugHandFacts facts={debugSnap?.facts ?? null} />
          <DebugProvenance pipelineResult={debugSnap?.pipelineResult ?? null} />
          <DebugPosterior posteriorSummary={debugSnap?.posteriorSummary ?? null} />
        </div>
      </details>
    {/if}

    <!-- Group 3: Feedback & History -->
    <details open={allOpen}>
      <summary class="text-[10px] font-bold uppercase tracking-widest text-text-muted cursor-pointer py-0.5 border-b border-border-subtle/30">Feedback & History</summary>
      <div class="pt-1 flex flex-col gap-0.5">
        {#if !isPlayingPhase}
          <DebugTeaching {feedback} />
        {/if}
        <DebugPublicBeliefs publicBeliefState={gameStore.publicBeliefState} allSeats={ALL_SEATS} />
        {#if !isPlayingPhase}
          <DebugBidLog debugLog={gameStore.debugLog} />
        {/if}
        <DebugPlayLog playLog={gameStore.playLog} />
      </div>
    </details>
  </div>
</aside>
