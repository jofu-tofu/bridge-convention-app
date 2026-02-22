<script lang="ts">
  import type { Contract } from "../../../engine/types";
  import type { BidHistoryEntry } from "../../../stores/game.svelte";
  import { STRAIN_SYMBOLS } from "../../../lib/format";
  import ContractDisplay from "./ContractDisplay.svelte";
  import BiddingReview from "../../game/BiddingReview.svelte";
  import Button from "../../shared/Button.svelte";

  interface Props {
    contract: Contract | null;
    score: number | null;
    declarerTricksWon: number;
    bidHistory: BidHistoryEntry[];
    onNextDeal: () => void;
    onBackToMenu: () => void;
  }

  let {
    contract,
    score,
    declarerTricksWon,
    bidHistory,
    onNextDeal,
    onBackToMenu,
  }: Props = $props();

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

<div class="flex flex-col gap-2 mt-2">
  <Button onclick={onNextDeal}>Next Deal</Button>
  <Button variant="secondary" onclick={onBackToMenu}>Back to Menu</Button>
</div>
