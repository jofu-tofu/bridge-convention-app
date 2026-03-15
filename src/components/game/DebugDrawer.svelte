<!-- Full-lifecycle debug drawer — comprehensive decision model inspector.
     Surfaces all internal pipeline state: facts, machine, arbitration, provenance,
     teaching, posterior, and beliefs. Uses persistent debug log so data survives
     between turns. See also: DebugPanel.svelte (inline correct bid hint). -->
<script lang="ts">
  import { Seat } from "../../engine/types";
  import { getGameStore, getAppStore } from "../../stores/context";
  import type { DebugSnapshot } from "../../stores/bidding.svelte";
  import type { BidFeedback } from "../../stores/game.svelte";

  import DebugSuggestedBid from "./debug/DebugSuggestedBid.svelte";
  import DebugHandFacts from "./debug/DebugHandFacts.svelte";
  import DebugConventionMachine from "./debug/DebugConventionMachine.svelte";
  import DebugPipeline from "./debug/DebugPipeline.svelte";
  import DebugProvenance from "./debug/DebugProvenance.svelte";
  import DebugTeaching from "./debug/DebugTeaching.svelte";
  import DebugBidLog from "./debug/DebugBidLog.svelte";
  import DebugPosterior from "./debug/DebugPosterior.svelte";
  import DebugPublicBeliefs from "./debug/DebugPublicBeliefs.svelte";
  import DebugDealInfo from "./debug/DebugDealInfo.svelte";
  import DebugAllHands from "./debug/DebugAllHands.svelte";
  import DebugPlayLog from "./debug/DebugPlayLog.svelte";

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
    <DebugSuggestedBid expectedBid={debugSnap?.expectedBid ?? null} />
    <DebugHandFacts facts={debugSnap?.facts ?? null} />
    <DebugConventionMachine machineSnapshot={debugSnap?.machineSnapshot ?? null} />
    <DebugPipeline arbitration={debugSnap?.arbitration ?? null} teachingProjection={debugSnap?.teachingProjection ?? null} />
    <DebugProvenance provenance={debugSnap?.provenance ?? null} />
    <DebugTeaching {feedback} />
    <DebugBidLog debugLog={gameStore.debugLog} />
    <DebugPosterior posteriorSummary={debugSnap?.posteriorSummary ?? null} />
    <DebugPublicBeliefs publicBeliefState={gameStore.publicBeliefState} allSeats={ALL_SEATS} />
    <DebugDealInfo
      conventionName={appStore.selectedConvention?.name ?? null}
      conventionId={appStore.selectedConvention?.id ?? null}
      devSeed={appStore.devSeed}
      dealer={gameStore.deal?.dealer}
      vulnerability={gameStore.deal?.vulnerability}
      phase={gameStore.phase}
    />
    <DebugAllHands deal={gameStore.deal} allSeats={ALL_SEATS} />
    <DebugPlayLog playLog={gameStore.playLog} />
  </div>
</aside>
