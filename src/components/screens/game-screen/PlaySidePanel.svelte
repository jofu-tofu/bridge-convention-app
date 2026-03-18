<script lang="ts">
  import type { Contract, Trick, Seat } from "../../../engine/types";
  import ContractDisplay from "./ContractDisplay.svelte";
  import PlayHistoryPanel from "./PlayHistoryPanel.svelte";
  import Button from "../../shared/Button.svelte";

  interface Props {
    contract: Contract | null;
    declarerTricksWon: number;
    defenderTricksWon: number;
    tricks: readonly Trick[];
    declarerSeat: Seat | null;
    onSkipToReview: () => void;
  }

  let {
    contract,
    declarerTricksWon,
    defenderTricksWon,
    tricks,
    declarerSeat,
    onSkipToReview,
  }: Props = $props();
</script>

{#if contract}
  <section
    class="bg-bg-card rounded-[--radius-lg] p-3 border border-border-subtle"
  >
    <h2
      class="text-xs font-medium text-text-muted mb-1 uppercase tracking-wider"
    >
      Contract
    </h2>
    <ContractDisplay {contract} size="lg" />
  </section>
{/if}

<section
  class="bg-bg-card rounded-[--radius-lg] p-3 border border-border-subtle"
>
  <h2 class="text-xs font-medium text-text-muted mb-1 uppercase tracking-wider">
    Tricks
  </h2>
  <div class="flex gap-4 text-lg font-mono text-text-primary">
    <span>Decl: {declarerTricksWon}</span>
    <span>Def: {defenderTricksWon}</span>
  </div>
</section>

<!-- Trick history (mobile/tablet only — desktop uses left panel) -->
<section class="flex-1 min-h-0 overflow-hidden lg:hidden">
  <PlayHistoryPanel {tricks} {declarerSeat} />
</section>

<div class="mt-auto">
  <Button variant="secondary" onclick={onSkipToReview}>Skip to Review</Button>
</div>
