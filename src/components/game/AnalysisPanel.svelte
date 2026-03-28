<script lang="ts">
  import type {
    DDSolution,
    Contract,
  } from "../../service";
  import { STRAIN_SYMBOLS } from "../../service";
  import MakeableContractsTable from "./MakeableContractsTable.svelte";
  import SectionHeader from "../shared/SectionHeader.svelte";

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
    <div class="flex items-center gap-1.5 mb-2">
      <SectionHeader level="h3">Makeable Contracts</SectionHeader>
      <div class="group relative">
        <button
          type="button"
          class="text-text-muted hover:text-text-secondary transition-colors cursor-help"
          aria-label="What are makeable contracts?"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
          </svg>
        </button>
        <div
          class="absolute left-0 top-full mt-1 w-56 p-2.5 rounded-[--radius-md] bg-bg-elevated border border-border-subtle shadow-lg text-[--text-label] text-text-secondary leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity z-[--z-tooltip]"
          role="tooltip"
        >
          Double Dummy Solver (DDS) analysis showing the maximum tricks each seat can take as declarer in each strain, assuming perfect play by all four hands.
        </div>
      </div>
    </div>
    <div
      class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle"
    >
      <MakeableContractsTable tricks={ddsSolution.tricks} />
    </div>
  </section>

  <!-- Actual vs Optimal -->
  {#if contract && score !== null && optimalTricks !== null}
    <section>
      <SectionHeader level="h3" class="mb-2">Actual vs Optimal</SectionHeader>
      <div
        class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle"
      >
        <div class="grid grid-cols-2 gap-2 text-[--text-detail]">
          <span class="text-text-secondary">Your tricks:</span>
          <span class="font-mono text-text-primary">{declarerTricksWon}</span>
          <span class="text-text-secondary">DDS optimal:</span>
          <span class="font-mono text-text-primary">{optimalTricks}</span>
          <span class="text-text-secondary">Difference:</span>
          <span
            class="font-mono {declarerTricksWon - optimalTricks >= 0 ? 'text-accent-success' : 'text-accent-danger'}"
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
      <SectionHeader level="h3" class="mb-2">Par Score</SectionHeader>
      <div
        class="bg-bg-card rounded-[--radius-md] p-3 border border-border-subtle"
      >
        <p class="text-[--text-value] font-semibold text-text-primary font-mono">
          {ddsSolution.par.score >= 0 ? "+" : ""}{ddsSolution.par.score}
        </p>
        {#if ddsSolution.par.contracts.length > 0}
          <div class="text-[--text-detail] text-text-secondary mt-1">
            {#each ddsSolution.par.contracts as pc (pc.declarer + pc.strain + pc.level)}
              <!-- Note: ParContract lacks `redoubled`, so formatContract(Contract) can't be used here -->
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
