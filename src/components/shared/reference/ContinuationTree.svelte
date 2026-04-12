<script lang="ts">
  import { slugifyMeaningId } from "../../../service";
  import BidCode from "./BidCode.svelte";
  import type {
    ReferenceContinuationPhase,
    ReferenceDisclosure,
    ReferenceRecommendation,
  } from "./types";

  interface Props {
    moduleId: string;
    phases: readonly ReferenceContinuationPhase[];
  }

  let { moduleId, phases }: Props = $props();

  const disclosureLabels: Record<ReferenceDisclosure, string> = {
    alert: "Alert",
    announcement: "Announce",
    natural: "Natural",
    standard: "Standard",
  };

  const recommendationClass: Record<ReferenceRecommendation, string> = {
    must: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    should: "border-sky-400/40 bg-sky-500/10 text-sky-100",
    may: "border-amber-400/40 bg-amber-500/10 text-amber-100",
    avoid: "border-rose-400/40 bg-rose-500/10 text-rose-100",
  };
</script>

<section class="root rounded-[--radius-lg] border border-border-default bg-bg-card p-4" aria-labelledby="continuation-tree-heading">
  <div class="mb-4 flex items-center justify-between gap-3">
    <h2 id="continuation-tree-heading" class="text-[--text-heading] font-semibold text-text-primary">
      Continuation Tree
    </h2>
    <span class="text-[--text-label] uppercase tracking-[0.12em] text-text-muted">
      Detailed View
    </span>
  </div>

  <div class="space-y-4">
    {#each phases as phase (phase.phase)}
      <section class="rounded-[--radius-md] border border-border-subtle bg-bg-base/70 p-4" aria-labelledby={`phase-${phase.phase}`}>
        <div class="mb-4">
          <h3 id={`phase-${phase.phase}`} class="text-[--text-body] font-semibold text-text-primary">
            {phase.phaseDisplay}
          </h3>
          {#if phase.transitionLabel}
            <p class="mt-1 text-[--text-detail] leading-6 text-text-muted">{phase.transitionLabel}</p>
          {/if}
        </div>

        <ol class="space-y-3 border-l border-border-default pl-4">
          {#each phase.surfaces as surface (surface.meaningId)}
            <li id={slugifyMeaningId(moduleId, surface.meaningId)} class="scroll-mt-24 pl-3">
              {#if surface.clauses.length > 0}
                <details class="group">
                  <summary class="cursor-pointer list-none rounded-[--radius-sm] px-2 py-2 hover:bg-bg-hover/40 focus-visible:outline-2 focus-visible:outline-accent-primary">
                    <div class="flex min-w-0 flex-wrap items-start gap-2">
                      <span class="chevron mt-1 text-text-muted" aria-hidden="true">▸</span>
                      <BidCode value={surface.call} />
                      <span class="min-w-0 break-words text-[--text-body] font-semibold text-text-primary">
                        {surface.teachingLabel.name}
                      </span>
                      {#if surface.recommendation}
                        <span class={`inline-flex rounded-full border px-2 py-1 text-[--text-annotation] font-semibold uppercase tracking-[0.08em] ${recommendationClass[surface.recommendation]}`.trim()}>
                          {surface.recommendation}
                        </span>
                      {/if}
                      {#if surface.disclosure}
                        <span class="inline-flex rounded-full border border-border-default px-2 py-1 text-[--text-annotation] uppercase tracking-[0.08em] text-text-muted">
                          {disclosureLabels[surface.disclosure]}
                        </span>
                      {/if}
                    </div>
                    {#if surface.explanationText || surface.teachingLabel.summary}
                      <p class="mt-2 break-words text-[--text-detail] leading-6 text-text-secondary">
                        {surface.explanationText ?? surface.teachingLabel.summary}
                      </p>
                    {/if}
                  </summary>

                  <div class="mt-2 space-y-2 border-l border-border-subtle pl-4">
                    {#each surface.clauses as clause (clause.factId + clause.description)}
                      <div class="rounded-[--radius-sm] bg-bg-card/80 px-3 py-2">
                        <p class={clause.isPublic ? "text-[--text-detail] leading-6 text-text-secondary" : "text-[--text-detail] leading-6 italic text-text-muted"}>
                          {clause.description}
                        </p>
                        {#if clause.systemVariants && clause.systemVariants.length > 0}
                          <div class="mt-2 flex flex-wrap gap-2">
                            {#each clause.systemVariants as variant (variant.systemLabel)}
                              <span class="rounded-full border border-border-default px-2 py-1 text-[--text-annotation] text-text-muted">
                                {variant.systemLabel}: {variant.description}
                              </span>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </details>
              {:else}
                <div class="rounded-[--radius-sm] px-2 py-2">
                  <div class="flex min-w-0 flex-wrap items-start gap-2">
                    <BidCode value={surface.call} />
                    <span class="min-w-0 break-words text-[--text-body] font-semibold text-text-primary">
                      {surface.teachingLabel.name}
                    </span>
                  </div>
                  {#if surface.explanationText || surface.teachingLabel.summary}
                    <p class="mt-2 break-words text-[--text-detail] leading-6 text-text-secondary">
                      {surface.explanationText ?? surface.teachingLabel.summary}
                    </p>
                  {/if}
                </div>
              {/if}
            </li>
          {/each}
        </ol>
      </section>
    {/each}
  </div>
</section>

<style>
  summary::-webkit-details-marker {
    display: none;
  }

  .group[open] .chevron {
    transform: rotate(90deg);
  }

  @media print {
    .root {
      display: none;
    }
  }
</style>
