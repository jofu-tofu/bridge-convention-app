<script lang="ts">
  import { page } from "$app/state";
  import type { LearnSidebarModule } from "../../routes/(content)/learn/+layout.server";

  interface Props {
    modules: LearnSidebarModule[];
  }

  const { modules }: Props = $props();

  let query = $state("");
  let mobileOpen = $state(false);

  const pathname = $derived(page.url.pathname);
  const normalizedQuery = $derived(query.trim().toLowerCase());

  function matches(mod: LearnSidebarModule, q: string): boolean {
    if (!q) return true;
    return (
      mod.displayName.toLowerCase().includes(q) ||
      mod.description.toLowerCase().includes(q) ||
      mod.moduleId.toLowerCase().includes(q)
    );
  }

  function isActive(moduleId: string): boolean {
    return pathname === `/learn/${moduleId}` || pathname === `/learn/${moduleId}/`;
  }

  const visibleCount = $derived(modules.filter((m) => matches(m, normalizedQuery)).length);
</script>

<button
  class="mobile-toggle"
  type="button"
  aria-expanded={mobileOpen}
  aria-controls="learn-sidebar-panel"
  onclick={() => (mobileOpen = !mobileOpen)}
>
  {mobileOpen ? "Hide" : "Browse"} conventions
</button>

<aside
  id="learn-sidebar-panel"
  class="sidebar"
  class:mobile-open={mobileOpen}
  aria-label="Convention library"
>
  <div class="search">
    <label class="visually-hidden" for="learn-sidebar-search">Search conventions</label>
    <input
      id="learn-sidebar-search"
      type="search"
      placeholder="Search conventions…"
      autocomplete="off"
      bind:value={query}
    />
    {#if normalizedQuery}
      <p class="search-meta" role="status" aria-live="polite">
        {visibleCount} {visibleCount === 1 ? "match" : "matches"}
      </p>
    {/if}
  </div>

  <nav aria-label="Conventions">
    <ul class="module-list">
      {#each modules as mod (mod.moduleId)}
        {@const active = isActive(mod.moduleId)}
        {@const hidden = !matches(mod, normalizedQuery)}
        <li class:hidden>
          <a
            href="/learn/{mod.moduleId}/"
            class:active
            aria-current={active ? "page" : undefined}
            onclick={() => (mobileOpen = false)}
          >
            <span class="name">{mod.displayName}</span>
            <span class="desc">{mod.description}</span>
          </a>
        </li>
      {/each}
    </ul>
  </nav>
</aside>

<style>
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .mobile-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    margin-bottom: 0.75rem;
    background: var(--color-bg-elevated, #141b2d);
    border: 1px solid var(--color-border-default, #1e293b);
    border-radius: 8px;
    color: var(--color-text-primary, #e8edf5);
    font-size: 0.875rem;
    cursor: pointer;
  }

  .sidebar {
    display: none;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }

  .sidebar.mobile-open {
    display: flex;
  }

  @media (min-width: 1024px) {
    .mobile-toggle { display: none; }
    .sidebar {
      display: flex;
      position: sticky;
      top: 1.5rem;
      max-height: calc(100vh - 3rem);
      overflow-y: auto;
      padding-inline: 0 0.75rem;
      scrollbar-gutter: stable;
    }
  }

  .search input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-base, #0a0f1a);
    border: 1px solid var(--color-border-default, #1e293b);
    border-radius: 8px;
    color: var(--color-text-primary, #e8edf5);
    font-size: 0.875rem;
  }

  .search input:focus {
    outline: 2px solid var(--color-accent-primary, #38bdf8);
    outline-offset: 1px;
  }

  .search-meta {
    margin: 0.375rem 0 0;
    font-size: 0.75rem;
    color: var(--color-text-muted, #64748b);
  }

  .module-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .module-list li.hidden { display: none; }

  .module-list a {
    display: block;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    text-decoration: none;
    color: var(--color-text-muted, #94a3b8);
    min-height: 44px;
    border: 1px solid transparent;
  }

  .module-list a:hover {
    background: var(--color-bg-hover, rgba(56, 189, 248, 0.08));
    color: var(--color-text-primary, #e8edf5);
  }

  .module-list a.active {
    background: var(--color-bg-hover, rgba(56, 189, 248, 0.12));
    border-color: var(--color-accent-primary, #38bdf8);
    color: var(--color-text-primary, #e8edf5);
  }

  .module-list .name {
    display: block;
    font-weight: 600;
    font-size: 0.875rem;
    color: inherit;
  }

  .module-list a.active .name { color: var(--color-accent-primary, #38bdf8); }

  .module-list .desc {
    display: block;
    font-size: 0.75rem;
    color: var(--color-text-muted, #64748b);
    margin-top: 0.125rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media print {
    .sidebar, .mobile-toggle { display: none !important; }
  }
</style>
