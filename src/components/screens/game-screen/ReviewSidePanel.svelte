<script lang="ts">
  import { SvelteMap } from "svelte/reactivity";
  import type { Contract, Vulnerability, Deal } from "../../../engine/types";
  import { Vulnerability as Vul } from "../../../engine/types";
  import type { BidHistoryEntry } from "../../../core/contracts";
  import type { ConventionConfig } from "../../../core/contracts/convention";
  import type { ConventionContribution } from "../../../core/contracts/teaching-projection";
  import { formatContractWithDeclarer, formatRuleName } from "../../../core/display/format";
  import { formatModuleRole, roleColorClasses } from "../../game/bid-feedback/BidFeedbackPanel";
  import type { DDSAnalysisProps } from "./shared-props";
  import ContractDisplay from "./ContractDisplay.svelte";
  import BiddingReview from "../../game/BiddingReview.svelte";
  import AnalysisPanel from "../../game/AnalysisPanel.svelte";
  import Button from "../../shared/Button.svelte";

  interface Props extends DDSAnalysisProps {
    contract: Contract | null;
    score: number | null;
    declarerTricksWon: number;
    bidHistory: BidHistoryEntry[];
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
    convention: _convention,
    deal: _deal,
  }: Props = $props();

  let activeTab = $state<"bidding" | "analysis">("bidding");

  // Reset to bidding tab on new deal
  $effect(() => {
    void dealNumber;
    activeTab = "bidding";
  });

  // Aggregate convention contributions across user bids that have teaching projections
  const conventionSummary = $derived.by(() => {
    const moduleMap = new SvelteMap<string, { role: ConventionContribution["role"]; count: number }>();
    for (const entry of bidHistory) {
      if (!entry.isUser || !entry.teachingProjection) continue;
      for (const contrib of entry.teachingProjection.conventionsApplied) {
        if (contrib.meaningsProposed.length === 0) continue;
        const existing = moduleMap.get(contrib.moduleId);
        if (!existing || (contrib.role === "primary" && existing.role !== "primary")) {
          moduleMap.set(contrib.moduleId, {
            role: contrib.role,
            count: (existing?.count ?? 0) + 1,
          });
        } else {
          existing.count++;
        }
      }
    }
    return [...moduleMap.entries()].map(([moduleId, data]) => ({
      moduleId,
      role: data.role,
      count: data.count,
    }));
  });
  const showConventionSummary = $derived(conventionSummary.length > 1);

  /** Human-readable vulnerability label */
  function formatVulnerability(v: Vulnerability): string {
    switch (v) {
      case Vul.None: return "None Vul";
      case Vul.NorthSouth: return "N-S Vul";
      case Vul.EastWest: return "E-W Vul";
      case Vul.Both: return "Both Vul";
    }
  }

  /** Format contract result like "3NT= — +400" or "2H -1 — -100" */
  function formatResult(): string | null {
    if (!contract || score === null) return null;
    const required = contract.level + 6;
    const contractWithDeclarer = formatContractWithDeclarer(contract);

    if (declarerTricksWon >= required) {
      const over = declarerTricksWon - required;
      const trickStr = over === 0 ? "=" : `+${over}`;
      return `${contractWithDeclarer} ${trickStr} — ${score >= 0 ? "+" : ""}${score}`;
    } else {
      const down = required - declarerTricksWon;
      return `${contractWithDeclarer} -${down} — ${score}`;
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
    class="flex-1 px-3 py-1.5 text-[--text-detail] font-medium rounded-[--radius-md] transition-colors cursor-pointer {activeTab === 'bidding'
      ? 'bg-bg-elevated text-text-primary'
      : 'text-text-muted hover:text-text-secondary'}"
    onclick={() => (activeTab = "bidding")}
  >
    Bidding
  </button>
  <button
    type="button"
    role="tab"
    aria-selected={activeTab === "analysis"}
    aria-controls="review-panel-analysis"
    class="flex-1 px-3 py-1.5 text-[--text-detail] font-medium rounded-[--radius-md] transition-colors cursor-pointer {activeTab === 'analysis'
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
        <div class="flex items-center justify-between mb-1">
          <p class="text-[--text-label] font-medium text-text-muted">Contract</p>
          <span
            class="text-[--text-annotation] px-2 py-0.5 rounded-full font-medium {vulnerability === Vul.None
              ? 'bg-bg-elevated text-text-muted'
              : 'bg-vulnerable/80 text-vulnerable-text ring-1 ring-vulnerable-ring/40'}"
            data-testid="vulnerability-label"
          >{formatVulnerability(vulnerability)}</span>
        </div>
        <ContractDisplay {contract} />
        {#if score !== null}
          {@const result = formatResult()}
          {#if result}
            <p
              class="text-[--text-value] font-mono mt-2 {score >= 0
                ? 'text-accent-success'
                : 'text-accent-danger'}"
              data-testid="score-result"
            >
              {result}
            </p>
          {/if}
        {/if}
      </div>
    {:else}
      <div class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle">
        <div class="flex items-center justify-between mb-1">
          <p class="text-text-muted text-[--text-detail]">Passed out — no contract.</p>
          <span
            class="text-[--text-annotation] px-2 py-0.5 rounded-full font-medium {vulnerability === Vul.None
              ? 'bg-bg-elevated text-text-muted'
              : 'bg-vulnerable/80 text-vulnerable-text ring-1 ring-vulnerable-ring/40'}"
            data-testid="vulnerability-label"
          >{formatVulnerability(vulnerability)}</span>
        </div>
      </div>
    {/if}

    <BiddingReview {bidHistory} />

    {#if showConventionSummary}
      <div class="mt-3 bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle">
        <p class="text-[--text-label] font-medium text-text-muted mb-2">Conventions in this deal</p>
        <div class="flex flex-wrap gap-1.5">
          {#each conventionSummary as mod (mod.moduleId)}
            <span
              class="inline-flex items-center gap-1 rounded border px-2 py-1 text-[--text-detail] {roleColorClasses(mod.role)}"
            >
              <span class="font-medium">{formatRuleName(mod.moduleId)}</span>
              <span class="opacity-70">{formatModuleRole(mod.role)}</span>
            </span>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{:else if activeTab === "analysis"}
  <div id="review-panel-analysis" role="tabpanel" aria-label="DDS analysis" class="min-w-0 overflow-x-hidden">
    {#if ddsSolving}
      <div class="flex items-center gap-2 p-4" aria-live="polite">
        <div
          class="w-4 h-4 border-2 border-accent-primary border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        ></div>
        <span class="text-text-secondary text-[--text-detail]">Analyzing deal...</span>
      </div>
    {:else if ddsError}
      <div
        class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle"
        role="alert"
      >
        <p class="text-text-muted text-[--text-detail]">{ddsError}</p>
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
        <p class="text-text-muted text-[--text-detail]">
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
