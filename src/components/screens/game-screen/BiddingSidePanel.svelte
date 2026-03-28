<script lang="ts">
  import { getGameStore } from "../../../stores/context";
  import BidPanel from "../../game/BidPanel.svelte";
  import BidFeedbackPanel from "../../game/bid-feedback/BidFeedbackPanel.svelte";
  import Spinner from "../../shared/Spinner.svelte";
  import SectionHeader from "../../shared/SectionHeader.svelte";
  import SettingsButton from "../../shared/SettingsButton.svelte";
  interface Props {
    onNewDeal: () => void;
    onOpenSettings: () => void;
    lifecycleDisabled?: boolean;
  }

  let {
    onNewDeal,
    onOpenSettings,
    lifecycleDisabled = false,
  }: Props = $props();

  const gameStore = getGameStore();

  // Grade-acceptance policy: isFeedbackBlocking covers near-miss/incorrect;
  // acceptable/correct-not-preferred show non-blocking feedback with bids enabled.
  const disabled = $derived(!gameStore.isUserTurn || gameStore.isFeedbackBlocking);
  const hasFeedback = $derived(gameStore.viewportFeedback !== null);
  const feedbackReplacesBidTable = $derived(
    gameStore.viewportFeedback !== null && gameStore.isFeedbackBlocking
  );
</script>

<div class="flex flex-col h-full min-h-0">
<div class="min-w-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
  <SectionHeader class="mb-2" ariaLive="polite">
    {#if gameStore.isUserTurn || hasFeedback}
      Your bid
    {:else}
      Waiting...
    {/if}
  </SectionHeader>
  {#if feedbackReplacesBidTable}
    <BidFeedbackPanel
      feedback={gameStore.viewportFeedback!}
      teaching={gameStore.teachingDetail}
      onRetry={() => gameStore.retryBid()}
    />
  {:else}
    <BidPanel legalCalls={gameStore.legalCalls} onBid={(call) => gameStore.userBid(call)} {disabled} compact />
    <div class="mt-3" class:hidden={!hasFeedback}>
      {#if gameStore.viewportFeedback}
        <BidFeedbackPanel
          feedback={gameStore.viewportFeedback}
          teaching={gameStore.teachingDetail}
          onRetry={() => gameStore.retryBid()}
        />
      {/if}
    </div>
  {/if}
</div>

  <div class="shrink-0 pt-3 mt-auto border-t border-border-subtle flex flex-col gap-2">
    <SettingsButton onclick={onOpenSettings} testId="bidding-open-settings" />
    <button
      class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[--radius-md] font-medium text-[--text-body] transition-colors bg-accent-primary hover:bg-accent-primary-hover text-text-on-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      onclick={onNewDeal}
      disabled={lifecycleDisabled}
      data-testid="settings-new-deal"
    >
      {#if lifecycleDisabled}
        <Spinner />
      {/if}
      New Deal
    </button>
  </div>
</div>
