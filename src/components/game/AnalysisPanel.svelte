<script lang="ts">
  import type {
    DDSolution,
    Contract,
  } from "../../engine/types";
  import { STRAIN_SYMBOLS } from "../../lib/format";
  import MakeableContractsTable from "./MakeableContractsTable.svelte";

  interface Props {
    ddsSolution: DDSolution;
    contract: Contract | null;
    score: number | null;
    declarerTricksWon: number;
  }

  let { ddsSolution, contract, score, declarerTricksWon }: Props =
    $props();

  const optimalTricks = $derived.by(() => {
    if (!contract) return null;
    return ddsSolution.tricks[contract.declarer]?.[contract.strain] ?? null;
  });
</script>

<div class="flex flex-col gap-4">
  <!-- Makeable Contracts Table -->
  <section>
    <h3 class="text-xs font-medium text-text-muted mb-2 uppercase tracking-wide">
      Makeable Contracts
    </h3>
    <div
      class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle"
    >
      <MakeableContractsTable tricks={ddsSolution.tricks} />
    </div>
  </section>

  <!-- Actual vs Optimal -->
  {#if contract && score !== null && optimalTricks !== null}
    <section>
      <h3
        class="text-xs font-medium text-text-muted mb-2 uppercase tracking-wide"
      >
        Actual vs Optimal
      </h3>
      <div
        class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle"
      >
        <div class="grid grid-cols-2 gap-2 text-sm">
          <span class="text-text-secondary">Your tricks:</span>
          <span class="font-mono text-text-primary">{declarerTricksWon}</span>
          <span class="text-text-secondary">DDS optimal:</span>
          <span class="font-mono text-text-primary">{optimalTricks}</span>
          <span class="text-text-secondary">Difference:</span>
          <span
            class="font-mono {declarerTricksWon - optimalTricks >= 0 ? 'text-green-400' : 'text-red-400'}"
          >
            {declarerTricksWon - optimalTricks >= 0 ? `+${declarerTricksWon - optimalTricks}` : String(declarerTricksWon - optimalTricks)}
          </span>
        </div>
      </div>
    </section>
  {/if}

  <!-- Par Score -->
  {#if ddsSolution.par}
    <section>
      <h3
        class="text-xs font-medium text-text-muted mb-2 uppercase tracking-wide"
      >
        Par Score
      </h3>
      <div
        class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle"
      >
        <p class="text-lg font-semibold text-text-primary font-mono">
          {ddsSolution.par.score >= 0 ? "+" : ""}{ddsSolution.par.score}
        </p>
        {#if ddsSolution.par.contracts.length > 0}
          <div class="text-sm text-text-secondary mt-1">
            {#each ddsSolution.par.contracts as pc (pc.declarer + pc.strain + pc.level)}
              <span class="mr-2">
                {pc.level}{STRAIN_SYMBOLS[pc.strain]}{pc.doubled ? "X" : ""}
                by {pc.declarer}{pc.overtricks > 0
                  ? ` +${pc.overtricks}`
                  : pc.overtricks < 0
                    ? ` ${pc.overtricks}`
                    : ""}
              </span>
            {/each}
          </div>
        {/if}
      </div>
    </section>
  {/if}
</div>
