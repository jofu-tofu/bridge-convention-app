<script lang="ts">
  import type { Contract, DDSolution, Vulnerability, Deal } from "../../../engine/types";
  import type { ConventionConfig } from "../../../conventions/core/types";
  import type { BidHistoryEntry } from "../../../stores/game.svelte";
  import { STRAIN_SYMBOLS } from "../../../display/format";
  import ContractDisplay from "./ContractDisplay.svelte";
  import BiddingReview from "../../game/BiddingReview.svelte";
  import AnalysisPanel from "../../game/AnalysisPanel.svelte";
  import AuctionRulesPanel from "../../game/AuctionRulesPanel.svelte";
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
    dealNumber: number;
    onNextDeal: () => void;
    onBackToMenu: () => void;
    onPlayHand?: (() => void) | undefined;
    convention?: ConventionConfig | undefined;
    deal?: Deal | undefined;
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
    dealNumber,
    onNextDeal,
    onBackToMenu,
    onPlayHand,
    convention,
    deal,
  }: Props = $props();

  let activeTab = $state<"bidding" | "rules" | "analysis">("bidding");

  // Reset to bidding tab on new deal
  $effect(() => {
    void dealNumber;
    activeTab = "bidding";
  });

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

<div class="flex flex-col min-w-0 w-full min-h-0 flex-1 overflow-hidden">
<!-- Tab bar -->
<div class="flex gap-1 mb-3 shrink-0" role="tablist" aria-label="Review tabs">
  <button
    type="button"
    role="tab"
    aria-selected={activeTab === "bidding"}
    aria-controls="review-panel-bidding"
    class="flex-1 px-3 py-1.5 text-sm font-medium rounded-[--radius-md] transition-colors cursor-pointer {activeTab === 'bidding'
      ? 'bg-bg-elevated text-text-primary'
      : 'text-text-muted hover:text-text-secondary'}"
    onclick={() => (activeTab = "bidding")}
  >
    Bidding
  </button>
  <button
    type="button"
    role="tab"
    aria-selected={activeTab === "rules"}
    aria-controls="review-panel-rules"
    class="flex-1 px-3 py-1.5 text-sm font-medium rounded-[--radius-md] transition-colors cursor-pointer {activeTab === 'rules'
      ? 'bg-bg-elevated text-text-primary'
      : 'text-text-muted hover:text-text-secondary'}"
    onclick={() => (activeTab = "rules")}
  >
    Rules
  </button>
  <button
    type="button"
    role="tab"
    aria-selected={activeTab === "analysis"}
    aria-controls="review-panel-analysis"
    class="flex-1 px-3 py-1.5 text-sm font-medium rounded-[--radius-md] transition-colors cursor-pointer {activeTab === 'analysis'
      ? 'bg-bg-elevated text-text-primary'
      : 'text-text-muted hover:text-text-secondary'}"
    onclick={() => (activeTab = "analysis")}
  >
    Analysis
  </button>
</div>

<div class="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0">
{#if activeTab === "bidding"}
  <div id="review-panel-bidding" role="tabpanel" aria-label="Bidding review">
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
  </div>
{:else if activeTab === "rules"}
  <div id="review-panel-rules" role="tabpanel" aria-label="Convention rules">
    <AuctionRulesPanel {bidHistory} />
  </div>
{:else if activeTab === "analysis"}
  <div id="review-panel-analysis" role="tabpanel" aria-label="DDS analysis" class="min-w-0 overflow-x-hidden">
    {#if ddsSolving}
      <div class="flex items-center gap-2 p-4" aria-live="polite">
        <div
          class="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        ></div>
        <span class="text-text-secondary text-sm">Analyzing deal...</span>
      </div>
    {:else if ddsError}
      <div
        class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle"
        role="alert"
      >
        <p class="text-text-muted text-sm">{ddsError}</p>
      </div>
    {:else if ddsSolution}
      <AnalysisPanel
        {ddsSolution}
        {contract}
        {score}
        {declarerTricksWon}
      />
    {:else}
      <div
        class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle"
      >
        <p class="text-text-muted text-sm">
          DDS analysis not available.
        </p>
      </div>
    {/if}
  </div>
{/if}
</div>

<div class="flex flex-col gap-2 pt-3 shrink-0">
  {#if onPlayHand}
    <Button onclick={onPlayHand}>Play this Hand</Button>
  {/if}
  <Button variant={onPlayHand ? "secondary" : "primary"} onclick={onNextDeal} testId="next-deal">Next Deal</Button>
  <Button variant="secondary" onclick={onBackToMenu} testId="review-back-to-menu">Back to Menu</Button>
</div>
</div>
