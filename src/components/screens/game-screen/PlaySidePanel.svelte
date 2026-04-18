<script lang="ts">
  import type { Contract } from "../../../service";
  import type { TrickScoreProps } from "./shared-props";
  import ContractDisplay from "./ContractDisplay.svelte";
  import Button from "../../shared/Button.svelte";
  import Spinner from "../../shared/Spinner.svelte";
  import SectionHeader from "../../shared/SectionHeader.svelte";

  interface Props extends TrickScoreProps {
    contract: Contract | null;
    onSkipToReview: () => void;
    onRestartPlay: () => void;
    disabled?: boolean;
  }

  let {
    contract,
    declarerTricksWon,
    defenderTricksWon,
    onSkipToReview,
    onRestartPlay,
    disabled = false,
  }: Props = $props();
</script>

{#if contract}
  <section
    class="bg-bg-card rounded-[--radius-lg] p-2 border border-border-subtle"
  >
    <SectionHeader class="mb-1">Contract</SectionHeader>
    <ContractDisplay {contract} size="lg" />
  </section>
{/if}

<section
  class="bg-bg-card rounded-[--radius-lg] p-2 border border-border-subtle"
>
  <SectionHeader class="mb-1">Tricks</SectionHeader>
  <div class="flex gap-4 text-[--text-value] font-mono text-text-primary">
    <span aria-label="Declarer: {declarerTricksWon} tricks">Decl: {declarerTricksWon}</span>
    <span aria-label="Defenders: {defenderTricksWon} tricks">Def: {defenderTricksWon}</span>
  </div>
</section>

<div class="mt-auto flex flex-col gap-2">
  <button
    class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[--radius-md] font-medium text-[--text-body] transition-colors border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    onclick={onRestartPlay}
    {disabled}
    data-testid="play-restart"
  >
    {#if disabled}
      <Spinner />
    {:else}
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
    {/if}
    Restart Play
  </button>
  <Button variant="secondary" onclick={onSkipToReview} {disabled}>Skip to Review</Button>
</div>
