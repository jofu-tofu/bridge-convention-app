<script lang="ts">
  import { slugifyMeaningId } from "../../../service";
  import type { FlowTreeNode, ModuleFlowTreeViewport } from "../../../service";
  import BidCode from "./BidCode.svelte";

  interface Props {
    moduleId: string;
    tree: ModuleFlowTreeViewport;
  }

  const { moduleId, tree }: Props = $props();
  const disclosureLabels: Record<string, string> = {
    alert: "Alert",
    announcement: "Announcement",
    natural: "Natural",
    standard: "Standard",
  };

  let expandAll = $state(false);
  const expandedNodes = $state<Record<string, boolean>>({});

  const introNode = $derived.by(() =>
    tree.root.children.length === 1 && tree.root.children[0]!.children.length > 0
      ? tree.root.children[0]!
      : null,
  );

  const topLevelNodes = $derived.by(() => introNode?.children ?? tree.root.children);

  function anchorId(node: FlowTreeNode): string | undefined {
    return node.meaningId ? slugifyMeaningId(moduleId, node.meaningId) : undefined;
  }

  function isOpen(node: FlowTreeNode): boolean {
    return expandAll || !!expandedNodes[node.id];
  }

  function setOpen(nodeId: string, open: boolean): void {
    expandedNodes[nodeId] = open;
  }

  function visualDisclosure(node: FlowTreeNode): string | null {
    if (!node.disclosure || node.disclosure === "standard") return null;
    return disclosureLabels[node.disclosure] ?? node.disclosure;
  }

  function srDisclosure(node: FlowTreeNode): string | null {
    if (!node.disclosure) return null;
    return disclosureLabels[node.disclosure] ?? node.disclosure;
  }
</script>

<section
  class="cl-root rounded-[--radius-lg] border border-border-default bg-bg-card p-4"
  aria-labelledby="continuation-list-heading"
>
  <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2
        id="continuation-list-heading"
        class="text-[--text-heading] font-semibold text-text-primary"
      >
        Continuations
      </h2>
      <p class="mt-1 text-[--text-detail] leading-6 text-text-muted">
        {introNode
          ? "Follow the first replies after the convention call, then open a branch to see its continuations."
          : "Open a branch to see the follow-up actions under each continuation."}
      </p>
    </div>
    <button
      type="button"
      class="cl-toggle-all"
      onclick={() => {
        if (expandAll) {
          expandAll = false;
          for (const node of topLevelNodes) {
            setOpen(node.id, false);
          }
        } else {
          expandAll = true;
        }
      }}
    >
      {expandAll ? "Collapse all follow-ups" : "Expand all follow-ups"}
    </button>
  </div>

  {#if introNode}
    <div class="cl-intro">
      <p class="cl-intro-label">Convention call</p>
      {@render header(introNode)}
    </div>
  {/if}

  <ol class="cl-level">
    {#each topLevelNodes as child (child.id)}
      {@render item(child, true)}
    {/each}
    {#if topLevelNodes.length === 0}
      {@render item(tree.root, false)}
    {/if}
  </ol>
</section>

{#snippet item(node: FlowTreeNode, collapsible: boolean)}
  <li id={anchorId(node)} class="cl-item scroll-mt-24">
    {#if collapsible && node.children.length > 0}
      <details
        class="cl-details"
        data-node-id={node.id}
        open={isOpen(node)}
        ontoggle={(event) => {
          setOpen(node.id, (event.currentTarget as HTMLDetailsElement).open);
        }}
      >
        <summary class="cl-summary">
          <div class="cl-summary-main">
            {@render header(node)}
          </div>
          <span class="cl-summary-label">
            {isOpen(node) ? "Hide follow-ups" : "Show follow-ups"}
          </span>
        </summary>

        <div class="cl-branch">
          {@render body(node)}
          <ol class="cl-level cl-nested">
            {#each node.children as child (child.id)}
              {@render item(child, false)}
            {/each}
          </ol>
        </div>
      </details>
    {:else}
      <div class="cl-row">
        {@render header(node)}
      </div>
      {@render body(node)}
      {#if node.children.length > 0}
        <ol class="cl-level cl-nested">
          {#each node.children as child (child.id)}
            {@render item(child, false)}
          {/each}
        </ol>
      {/if}
    {/if}
  </li>
{/snippet}

{#snippet header(node: FlowTreeNode)}
  <div class="cl-header">
    {#if node.call}
      <BidCode value={node.call} />
    {:else if node.callDisplay}
      <span class="cl-call-text">{node.callDisplay}</span>
    {/if}
    <span class="cl-label">{node.label}</span>
    {#if node.turn}
      <span class="cl-turn">{node.turn}</span>
    {/if}
    {#if visualDisclosure(node)}
      <span class="cl-disclosure">{visualDisclosure(node)}</span>
    {/if}
    {#if srDisclosure(node)}
      <span class="sr-only">Disclosure: {srDisclosure(node)}</span>
    {/if}
  </div>
{/snippet}

{#snippet body(node: FlowTreeNode)}
  {#if node.explanationText && node.explanationText !== "internal"}
    <p class="cl-explanation">{node.explanationText}</p>
  {/if}
  {#if node.clauses.length > 0}
    <div class="cl-clauses">
      {#each node.clauses as clause (clause.factId + clause.description)}
        <div class="cl-clause">
          <p class={clause.isPublic ? "cl-clause-public" : "cl-clause-private"}>
            {clause.description}
          </p>
          {#if clause.systemVariants && clause.systemVariants.length > 0}
            <div class="cl-variants">
              {#each clause.systemVariants as variant (variant.systemLabel)}
                <span class="cl-variant">
                  {variant.systemLabel}: {variant.description}
                </span>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
{/snippet}

<style>
  .cl-level {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .cl-item {
    min-width: 0;
  }

  .cl-toggle-all {
    appearance: none;
    border: 1px solid var(--color-border-default);
    border-radius: 9999px;
    padding: 0.35rem 0.85rem;
    font-size: var(--text-annotation, 0.7rem);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    background: transparent;
    cursor: pointer;
  }

  .cl-toggle-all:hover,
  .cl-toggle-all:focus-visible {
    color: var(--color-text-primary);
    border-color: var(--color-accent-primary);
  }

  .cl-intro {
    margin-bottom: 1rem;
    padding: 0.75rem 0.9rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border-subtle);
    background: color-mix(in srgb, var(--color-bg-base) 72%, transparent);
  }

  .cl-intro-label {
    margin: 0 0 0.35rem;
    font-size: var(--text-label, 0.75rem);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .cl-details,
  .cl-row {
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--color-bg-card) 92%, transparent);
  }

  .cl-summary {
    list-style: none;
    cursor: pointer;
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 0.9rem;
  }

  .cl-summary::-webkit-details-marker {
    display: none;
  }

  .cl-summary-main {
    min-width: 0;
  }

  .cl-summary-label {
    font-size: var(--text-annotation, 0.7rem);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .cl-row {
    padding: 0.75rem 0.9rem;
  }

  .cl-branch {
    padding: 0 0.9rem 0.9rem;
  }

  .cl-nested {
    margin-top: 0.75rem;
    padding-left: 1rem;
    border-left: 1px solid var(--color-border-subtle);
    gap: 0.5rem;
  }

  .cl-header {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
    min-width: 0;
  }

  .cl-call-text {
    font-family: ui-monospace, monospace;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .cl-label {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .cl-turn {
    font-size: var(--text-annotation, 0.7rem);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .cl-disclosure {
    display: inline-flex;
    padding: 0.1rem 0.45rem;
    font-size: var(--text-annotation, 0.7rem);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--color-accent-primary) 10%, transparent);
    color: var(--color-text-muted);
  }

  .cl-explanation {
    margin-top: 0.3rem;
    color: var(--color-text-secondary);
    font-size: var(--text-detail, 0.875rem);
    line-height: 1.5;
  }

  .cl-clauses {
    margin-top: 0.45rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .cl-clause {
    padding: 0.45rem 0.6rem;
    background: color-mix(in srgb, var(--color-bg-base) 65%, transparent);
    border-radius: var(--radius-sm);
  }

  .cl-clause-public {
    color: var(--color-text-secondary);
    font-size: var(--text-detail, 0.875rem);
    line-height: 1.5;
  }

  .cl-clause-private {
    color: var(--color-text-muted);
    font-size: var(--text-detail, 0.875rem);
    line-height: 1.5;
    font-style: italic;
  }

  .cl-variants {
    margin-top: 0.35rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .cl-variant {
    padding: 0.1rem 0.45rem;
    border: 1px solid var(--color-border-default);
    border-radius: 9999px;
    color: var(--color-text-muted);
    font-size: var(--text-annotation, 0.7rem);
  }

  @media (max-width: 767px) {
    .cl-summary {
      flex-direction: column;
      gap: 0.45rem;
    }

    .cl-summary-label {
      white-space: normal;
    }
  }
</style>
