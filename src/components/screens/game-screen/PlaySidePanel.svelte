<script lang="ts">
  import type { Contract } from "../../../service";
  import type { TrickScoreProps } from "./shared-props";
  import ContractDisplay from "./ContractDisplay.svelte";
  import Button from "../../shared/Button.svelte";

  interface Props extends TrickScoreProps {
    contract: Contract | null;
    onSkipToReview: () => void;
    onRestartPlay: () => void;
    onOpenSettings: () => void;
  }

  let {
    contract,
    declarerTricksWon,
    defenderTricksWon,
    onSkipToReview,
    onRestartPlay,
    onOpenSettings,
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

<div class="mt-auto flex flex-col gap-2">
  <button
    class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[--radius-md] font-medium text-[--text-body] transition-colors border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default cursor-pointer"
    onclick={onOpenSettings}
    data-testid="play-open-settings"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
    Settings
  </button>
  <button
    class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[--radius-md] font-medium text-[--text-body] transition-colors border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default cursor-pointer"
    onclick={onRestartPlay}
    data-testid="play-restart"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
    Restart Play
  </button>
  <Button variant="secondary" onclick={onSkipToReview}>Skip to Review</Button>
</div>
