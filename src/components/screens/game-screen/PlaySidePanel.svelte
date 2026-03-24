<script lang="ts">
  import type { Contract } from "../../../service";
  import type { TrickScoreProps } from "./shared-props";
  import ContractDisplay from "./ContractDisplay.svelte";
  import Button from "../../shared/Button.svelte";

  interface Props extends TrickScoreProps {
    contract: Contract | null;
    onSkipToReview: () => void;
  }

  let {
    contract,
    declarerTricksWon,
    defenderTricksWon,
    onSkipToReview,
  }: Props = $props();
</script>

{#if contract}
  <section
    class="bg-bg-card rounded-[--radius-lg] p-2 border border-border-subtle"
  >
    <h2
      class="text-[--text-label] font-medium text-text-muted mb-1 uppercase tracking-wider"
    >
      Contract
    </h2>
    <ContractDisplay {contract} size="lg" />
  </section>
{/if}

<section
  class="bg-bg-card rounded-[--radius-lg] p-2 border border-border-subtle"
>
  <h2 class="text-[--text-label] font-medium text-text-muted mb-1 uppercase tracking-wider">
    Tricks
  </h2>
  <div class="flex gap-4 text-[--text-value] font-mono text-text-primary">
    <span aria-label="Declarer: {declarerTricksWon} tricks">Decl: {declarerTricksWon}</span>
    <span aria-label="Defenders: {defenderTricksWon} tricks">Def: {defenderTricksWon}</span>
  </div>
</section>

<div class="mt-auto">
  <Button variant="secondary" onclick={onSkipToReview}>Skip to Review</Button>
</div>
