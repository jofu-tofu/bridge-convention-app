<!-- Phase-aware shortcut buttons for navigating the game without manual input.
     Sits at the top of DebugDrawer; each button wraps a single gameStore /
     appStore method so dev workflows can skip the parts that are tedious to
     drive by hand.

     Layout: one action per row — fixed-width button on the left, plain-language
     description on the right. Each button also carries a `title=` tooltip with
     the precise effect, so hovering surfaces the same info if the description
     is truncated. All actions disable while gameStore.isProcessing.

     The "Show details" toggle expands each row to show subtle / non-obvious
     behavior (auto-bid fallbacks, seat swaps, animation timing). Default
     collapsed to keep the panel scannable. -->
<script lang="ts">
  import { getGameStore, getAppStore } from "../../../stores/context";
  import type { Call } from "../../../service";

  interface Props {
    onNewDeal?: () => void;
    onBackToMenu?: () => void;
  }

  let { onNewDeal, onBackToMenu }: Props = $props();

  const gameStore = getGameStore();
  const appStore = getAppStore();

  const phase = $derived(gameStore.phase);
  const busy = $derived(gameStore.isProcessing);

  let showDetails = $state(false);

  function bidExpected() {
    void gameStore.getExpectedBid().then((result) => {
      const call: Call = result?.call ?? { type: "pass" };
      gameStore.userBid(call);
    });
  }

  function passNow() {
    gameStore.userBid({ type: "pass" });
  }

  async function finishAuction() {
    await gameStore.skipToPhase("declarer");
  }

  async function skipToPlaying() {
    await gameStore.skipToPhase("playing");
  }

  async function skipToReviewFromBidding() {
    await gameStore.skipToPhase("review");
  }

  const BTN_BASE =
    "px-1.5 py-0.5 rounded text-[10px] font-semibold border border-border-subtle/40 " +
    "bg-bg-card/60 hover:bg-bg-card text-text-secondary hover:text-text-primary " +
    "disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors " +
    "shrink-0 text-left";

  const TOGGLE_ON = "bg-amber-900/60 text-amber-200 border-amber-700/60";

  const BTN_W = "w-[6.75rem]";
</script>

<div class="rounded border border-border-subtle/40 bg-bg-card/40 px-2 py-1.5 flex flex-col gap-1">
  <div class="flex items-center justify-between">
    <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted">Dev Actions</span>
    <button
      class="text-[10px] px-1.5 py-0.5 rounded border border-border-subtle/40 text-text-muted hover:text-text-primary cursor-pointer"
      onclick={() => (showDetails = !showDetails)}
      aria-pressed={showDetails}
      data-testid="dev-toggle-details"
      title="Toggle inline descriptions for every action"
    >{showDetails ? "Hide details" : "Show details"}</button>
  </div>

  {#snippet action(testId: string, label: string, summary: string, detail: string, onclick: () => void, opts: { disabled?: boolean; tone?: string } = {})}
    <div class="flex items-baseline gap-2">
      <button
        class="{BTN_BASE} {BTN_W} {opts.tone ?? ''}"
        disabled={opts.disabled ?? busy}
        {onclick}
        data-testid={testId}
        title="{summary} — {detail}"
      >{label}</button>
      <span class="text-[10px] text-text-muted leading-tight flex-1 min-w-0">
        {summary}{#if showDetails}<span class="text-text-muted/70"> — {detail}</span>{/if}
      </span>
    </div>
  {/snippet}

  {#if phase === "BIDDING"}
    <div class="flex flex-col gap-0.5">
      <span class="text-[10px] uppercase tracking-wider text-text-muted">Bidding</span>
      {@render action(
        "dev-bid-expected", "Bid expected",
        "Submit recommended bid for this turn.",
        "Calls getExpectedBid; falls back to Pass if no convention rule matches your hand.",
        bidExpected,
        { disabled: busy || !gameStore.isUserTurn },
      )}
      {@render action(
        "dev-pass", "Pass",
        "Submit a pass for this turn.",
        "Single-bid Pass; AI partner/opponents bid normally afterward.",
        passNow,
        { disabled: busy || !gameStore.isUserTurn },
      )}
      {@render action(
        "dev-finish-auction", "Finish auction",
        "Auto-bid the rest → declarer prompt.",
        "Auto-bids your remaining turns with expected bids (Pass if undefined). Lands in DECLARER_PROMPT, or EXPLANATION if all-pass.",
        finishAuction,
        { tone: "text-amber-300" },
      )}
      {@render action(
        "dev-skip-to-playing", "Skip to playing",
        "Auto-bid + accept prompt → PLAYING.",
        "Same as Finish auction, then auto-accepts the prompt. May silently swap your seat to declarer if your partner declares.",
        skipToPlaying,
        { tone: "text-blue-300" },
      )}
      {@render action(
        "dev-skip-to-review", "Skip to review",
        "Auto-bid + decline prompt → review.",
        "Same as Finish auction, then auto-declines the prompt. The hand is not played.",
        skipToReviewFromBidding,
        { tone: "text-green-300" },
      )}
    </div>
  {/if}

  {#if phase === "DECLARER_PROMPT"}
    <div class="flex flex-col gap-0.5">
      <span class="text-[10px] uppercase tracking-wider text-text-muted">Prompt</span>
      {@render action(
        "dev-accept-prompt", "Accept (play)",
        "Enter PLAYING phase.",
        "Same as the Accept button. Swaps your seat to declarer if your partner declares.",
        () => { void gameStore.acceptPrompt(); },
        { tone: "text-blue-300" },
      )}
      {@render action(
        "dev-decline-prompt", "Skip to review",
        "Decline prompt → review.",
        "Same as the Decline button; jumps to EXPLANATION without playing the hand.",
        () => { void gameStore.declinePrompt(); },
        { tone: "text-green-300" },
      )}
    </div>
  {/if}

  {#if phase === "PLAYING"}
    <div class="flex flex-col gap-0.5">
      <span class="text-[10px] uppercase tracking-wider text-text-muted">Play</span>
      {@render action(
        "dev-autoplay-hand", "Auto-play to end",
        "Finish the hand → review.",
        "User seats use first-legal-play (NOT DDS-best); opponents use the configured profile (Expert+ uses DDS). No animation; lands in EXPLANATION with the full play log captured.",
        () => { void gameStore.autoPlayHand(); },
        { tone: "text-green-300" },
      )}
      {@render action(
        "dev-restart-play", "Restart play",
        "Restart from trick 1.",
        "Resets the play phase only — auction and contract are unchanged.",
        () => { void gameStore.restartPlay(); },
      )}
      {@render action(
        "dev-abandon-hand", "Abandon hand",
        "Drop mid-trick → review.",
        "Hard skip — flips phase to EXPLANATION without finishing the hand. Use Auto-play to end if you want a completed play log.",
        () => { void gameStore.skipToReview(); },
      )}
    </div>
  {/if}

  {#if phase === "EXPLANATION"}
    <div class="flex flex-col gap-0.5">
      <span class="text-[10px] uppercase tracking-wider text-text-muted">Review</span>
      {#if onNewDeal}
        {@render action(
          "dev-next-deal", "Next deal",
          "Start a new deal.",
          "In multi-module drills, rotates round-robin to the next module.",
          onNewDeal,
          { tone: "text-blue-300" },
        )}
      {/if}
      {#if gameStore.contract}
        {@render action(
          "dev-play-this-hand", "Play this hand",
          "Replay this contract → PLAYING.",
          "Re-enters the play phase for the same auction/contract; useful for trying different lines.",
          () => { void gameStore.playThisHand(); },
        )}
      {/if}
      {#if onBackToMenu}
        {@render action(
          "dev-back-to-menu", "Back to menu",
          "Reset → /practice.",
          "Resets the session and navigates to the practice picker.",
          onBackToMenu,
        )}
      {/if}
    </div>
  {/if}

  <div class="flex flex-col gap-0.5 pt-0.5 border-t border-border-subtle/30">
    <span class="text-[10px] uppercase tracking-wider text-text-muted">Toggles</span>

    <div class="flex items-baseline gap-2">
      <button
        class="{BTN_BASE} {BTN_W} {appStore.autoplay ? TOGGLE_ON : ''}"
        onclick={() => appStore.setAutoplay(!appStore.autoplay)}
        aria-pressed={appStore.autoplay}
        data-testid="dev-toggle-autoplay"
        title="Autoplay — Auto-bids the recommended call, auto-accepts prompts, and plays the first legal card on user turns. Persists across deals until toggled off."
      >Autoplay {appStore.autoplay ? "(on)" : "(off)"}</button>
      <span class="text-[10px] text-text-muted leading-tight flex-1 min-w-0">
        Auto-bid + auto-accept + auto-play.{#if showDetails}<span class="text-text-muted/70"> Persists across new deals — toggle off to stop.</span>{/if}
      </span>
    </div>

    <div class="flex items-baseline gap-2">
      <button
        class="{BTN_BASE} {BTN_W} {appStore.autoDismissFeedback ? TOGGLE_ON : ''}"
        onclick={() => appStore.setAutoDismissFeedback(!appStore.autoDismissFeedback)}
        aria-pressed={appStore.autoDismissFeedback}
        data-testid="dev-toggle-auto-dismiss"
        title="Auto-dismiss — Auto-retries blocking bid feedback after ~100ms, so wrong-bid panels don't block. Does not affect non-blocking (correct/acceptable) feedback."
      >Auto-dismiss {appStore.autoDismissFeedback ? "(on)" : "(off)"}</button>
      <span class="text-[10px] text-text-muted leading-tight flex-1 min-w-0">
        Auto-retry wrong bids (~100ms).{#if showDetails}<span class="text-text-muted/70"> Only blocking feedback — non-blocking (green) feedback is unaffected.</span>{/if}
      </span>
    </div>
  </div>

  {#if busy}
    <div class="text-[10px] text-amber-300/70 italic">Busy — actions disabled while a transition is in flight.</div>
  {/if}
</div>
