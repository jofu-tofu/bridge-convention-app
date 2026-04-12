<script lang="ts">
  import { readCustomSystems } from "./landing-helpers";
  import { FEATURES } from "../../../stores/feature-flags";

  const systems = $derived(readCustomSystems());
  const editorBase = "/convention-editor";
</script>

<section class="your-systems">
  <h2>Your custom systems{systems.length ? ` (${systems.length})` : ""}</h2>
  {#if systems.length === 0}
    <p class="empty">
      No custom systems yet{#if FEATURES.workshop} — <a href={editorBase}>create one</a>{/if}.
    </p>
  {:else}
    <ul>
      {#each systems as sys (sys.id)}
        <li>
          <span class="name">{sys.name}</span>
          {#if FEATURES.workshop}
            <a class="edit" href={`${editorBase}?systemId=${encodeURIComponent(sys.id)}`}>edit →</a>
          {/if}
        </li>
      {/each}
    </ul>
    {#if FEATURES.workshop}
      <a class="new" href={editorBase}>+ New system</a>
    {/if}
  {/if}
</section>

<style>
  .your-systems {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  h2 {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    margin: 0 0 0.25rem;
  }
  .empty {
    color: var(--color-text-secondary);
    font-size: 0.95rem;
    margin: 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    background: var(--color-bg-elevated, rgba(15, 23, 42, 0.4));
  }
  .name {
    color: var(--color-text-primary);
  }
  .edit,
  .new {
    color: var(--color-accent-primary);
    text-decoration: none;
    font-size: 0.9rem;
  }
  .new {
    margin-top: 0.25rem;
  }
  a:hover {
    text-decoration: underline;
  }
</style>
