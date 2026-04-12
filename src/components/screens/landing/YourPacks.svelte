<script lang="ts">
  import { readPracticePacks } from "./landing-helpers";
  import { FEATURES } from "../../../stores/feature-flags";

  const packs = $derived(readPracticePacks());
</script>

{#if packs.length > 0}
  <section class="your-packs">
    <h2>Practice packs ({packs.length})</h2>
    <ul>
      {#each packs as pack (pack.id)}
        <li>
          <span class="name">{pack.name}</span>
          {#if FEATURES.workshop}
            <a
              class="edit"
              href={`/practice-pack-editor?packId=${encodeURIComponent(pack.id)}`}>open →</a
            >
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .your-packs {
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
  .edit {
    color: var(--color-accent-primary);
    text-decoration: none;
    font-size: 0.9rem;
  }
  .edit:hover {
    text-decoration: underline;
  }
</style>
