<script lang="ts">
  import type { ConventionConfig } from "../../conventions/types";
  import type { Deal } from "../../engine/types";
  import type { BidHistoryEntry } from "../../stores/game.svelte";
  import { prepareRulesForDisplay } from "../../lib/rules-display";
  import type { DisplayRule } from "../../lib/rules-display";
  import { formatCall } from "../../lib/format";
  import { BID_SUIT_COLOR_CLASS } from "../../lib/tokens";

  interface Props {
    convention: ConventionConfig;
    deal: Deal;
    bidHistory: BidHistoryEntry[];
  }

  let { convention, deal, bidHistory }: Props = $props();

  const ruleData = $derived(
    prepareRulesForDisplay(convention, deal, bidHistory),
  );

  function callColorClass(rule: DisplayRule): string {
    if (!rule.call || rule.call.type !== "bid") return "text-text-primary";
    return BID_SUIT_COLOR_CLASS[rule.call.strain];
  }

  function callText(rule: DisplayRule): string | null {
    if (!rule.call) return null;
    return formatCall(rule.call);
  }
</script>

<div class="flex flex-col gap-4 overflow-hidden">
  <div class="flex flex-col gap-1">
    <h2 class="text-base font-semibold text-text-primary">
      {convention.name} Convention Rules
    </h2>
    <p class="text-xs text-text-muted">
      Reference for all bidding rules in this convention
    </p>
  </div>

  {#if ruleData.firedRules.length === 0 && ruleData.referenceRules.length === 0}
    <div
      class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle"
    >
      <p class="text-text-muted text-sm">
        No rules defined for this convention.
      </p>
    </div>
  {:else}
    <div class="flex flex-col gap-2.5">
      {#each ruleData.firedRules as rule (rule.ruleName)}
        <div
          class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle flex flex-col gap-2 min-w-0"
          data-testid="rule-card-fired"
        >
          <div class="flex items-center justify-between min-w-0 gap-2">
            <span
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-accent-primary-subtle text-accent-primary border border-accent-primary/40 truncate max-w-full"
            >
              {rule.displayName}
            </span>
            {#if callText(rule)}
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-sm font-bold bg-bg-elevated {callColorClass(rule)} font-mono"
              >
                {callText(rule)}
              </span>
            {/if}
          </div>
          <div class="flex flex-col gap-1">
            {#each rule.conditions as cond (cond.name)}
              <p class="text-xs text-text-muted break-words">
                &bull; {cond.description}
              </p>
            {/each}
          </div>
        </div>
      {/each}

      {#each ruleData.referenceRules as rule (rule.ruleName)}
        <div
          class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle flex flex-col gap-2 min-w-0"
          data-testid="rule-card-reference"
        >
          <div class="flex items-center justify-between min-w-0 gap-2">
            <span
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-accent-primary-subtle text-accent-primary border border-accent-primary/40 truncate max-w-full"
            >
              {rule.displayName}
            </span>
            {#if callText(rule)}
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-sm font-bold bg-bg-elevated {callColorClass(rule)} font-mono"
              >
                {callText(rule)}
              </span>
            {/if}
          </div>
          <div class="flex flex-col gap-1">
            {#each rule.conditions as cond (cond.name)}
              <p class="text-xs text-text-muted break-words">
                &bull; {cond.description}
              </p>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
