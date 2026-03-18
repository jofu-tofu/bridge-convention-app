<script lang="ts">
  import type { Contract } from "../../../engine/types";
  import ContractDisplay from "./ContractDisplay.svelte";
  import Button from "../../shared/Button.svelte";

  interface Props {
    contract: Contract | null;
    declarerTricksWon: number;
    defenderTricksWon: number;
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

<div class="mt-auto">
  <Button variant="secondary" onclick={onSkipToReview}>Skip to Review</Button>
</div>
