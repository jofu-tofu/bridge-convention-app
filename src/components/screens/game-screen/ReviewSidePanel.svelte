<script lang="ts">
  import type { Contract, DDSolution, Vulnerability } from "../../../engine/types";
  import type { BidHistoryEntry } from "../../../stores/game.svelte";
  import { STRAIN_SYMBOLS } from "../../../lib/format";
  import ContractDisplay from "./ContractDisplay.svelte";
  import BiddingReview from "../../game/BiddingReview.svelte";
  import AnalysisPanel from "../../game/AnalysisPanel.svelte";
  import Button from "../../shared/Button.svelte";

  interface Props {
    contract: Contract | null;
    score: number | null;
    declarerTricksWon: number;
    bidHistory: BidHistoryEntry[];
    ddsSolution: DDSolution | null;
    ddsSolving: boolean;
    ddsError: string | null;
    vulnerability: Vulnerability;
    onNextDeal: () => void;
    onBackToMenu: () => void;
  }

  let {
    contract,
    score,
    declarerTricksWon,
    bidHistory,
    ddsSolution,
    ddsSolving,
    ddsError,
    vulnerability,
    onNextDeal,
    onBackToMenu,
  }: Props = $props();

  let activeTab = $state<"bidding" | "analysis">("bidding");

  /** Format contract result like "3NT= — +400" or "2H -1 — -100" */
  function formatResult(): string | null {
    if (!contract || score === null) return null;
    const required = contract.level + 6;
    const contractStr = `${contract.level}${STRAIN_SYMBOLS[contract.strain]}${contract.doubled ? "X" : ""}${contract.redoubled ? "XX" : ""}`;

    if (declarerTricksWon >= required) {
      const over = declarerTricksWon - required;
      const trickStr = over === 0 ? "=" : `+${over}`;
      return `${contractStr} by ${contract.declarer} ${trickStr} — ${score >= 0 ? "+" : ""}${score}`;
    } else {
      const down = required - declarerTricksWon;
      return `${contractStr} by ${contract.declarer} -${down} — ${score}`;
    }
  }
</script>

<!-- Tab bar -->
<div class="flex gap-1 mb-3">
  <button
    type="button"
    class="flex-1 px-3 py-1.5 text-sm font-medium rounded-[--radius-md] transition-colors cursor-pointer {activeTab === 'bidding'
      ? 'bg-bg-elevated text-text-primary'
      : 'text-text-muted hover:text-text-secondary'}"
    onclick={() => (activeTab = "bidding")}
  >
    Bidding
  </button>
  <button
    type="button"
    class="flex-1 px-3 py-1.5 text-sm font-medium rounded-[--radius-md] transition-colors cursor-pointer {activeTab === 'analysis'
      ? 'bg-bg-elevated text-text-primary'
      : 'text-text-muted hover:text-text-secondary'}"
    onclick={() => (activeTab = "analysis")}
  >
    Analysis
  </button>
</div>

{#if activeTab === "bidding"}
  {#if contract}
    <div class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle">
      <p class="text-xs font-medium text-text-muted mb-1">Contract</p>
      <ContractDisplay {contract} />
      {#if score !== null}
        {@const result = formatResult()}
        {#if result}
          <p
            class="text-base font-mono mt-2 {score >= 0
              ? 'text-green-400'
              : 'text-red-400'}"
            data-testid="score-result"
          >
            {result}
          </p>
        {/if}
      {/if}
    </div>
  {:else}
    <div class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle">
      <p class="text-text-muted text-sm">Passed out — no contract.</p>
    </div>
  {/if}

  <BiddingReview {bidHistory} />
{:else if activeTab === "analysis"}
  {#if ddsSolving}
    <div class="flex items-center gap-2 p-4">
      <div
        class="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"
      ></div>
      <span class="text-text-secondary text-sm">Analyzing deal...</span>
    </div>
  {:else if ddsError}
    <div
      class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle"
    >
      <p class="text-text-muted text-sm">{ddsError}</p>
    </div>
  {:else if ddsSolution}
    <AnalysisPanel
      {ddsSolution}
      {contract}
      {score}
      {declarerTricksWon}
      {vulnerability}
    />
  {:else}
    <div
      class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle"
    >
      <p class="text-text-muted text-sm">
        DDS analysis not available in browser mode.
      </p>
    </div>
  {/if}
{/if}

<div class="flex flex-col gap-2 mt-2">
  <Button onclick={onNextDeal}>Next Deal</Button>
  <Button variant="secondary" onclick={onBackToMenu}>Back to Menu</Button>
</div>
