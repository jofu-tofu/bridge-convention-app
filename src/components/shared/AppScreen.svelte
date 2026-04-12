<script lang="ts">
  import type { Snippet } from "svelte";

  type Width = "wide" | "form" | "custom";

  interface Props {
    title?: string;
    subtitle?: string;
    width?: Width;
    actions?: Snippet;
    tabs?: Snippet;
    scroll?: boolean;
    contentClass?: string;
    children: Snippet;
  }

  const {
    title,
    subtitle,
    width = "wide",
    actions,
    tabs,
    scroll = true,
    contentClass,
    children,
  }: Props = $props();
</script>

<section class="app-screen" data-width={width}>
  {#if title}
    <header class="app-screen__header">
      <div class="app-screen__titles">
        <h1>{title}</h1>
        {#if subtitle}<p class="app-screen__subtitle">{subtitle}</p>{/if}
      </div>
      {#if actions}
        <div class="app-screen__actions">{@render actions()}</div>
      {/if}
    </header>
  {/if}
  {#if tabs}
    <div class="app-screen__tabs">{@render tabs()}</div>
  {/if}
  <div class="app-screen__body {contentClass ?? ''}" data-scroll={scroll}>
    {@render children()}
  </div>
</section>

<style>
  .app-screen {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
    max-width: var(--screen-max-app);
    margin: 0 auto;
    padding: var(--screen-gutter-y) var(--screen-gutter-x) 0;
  }

  @media (min-width: 640px) {
    .app-screen {
      padding: var(--screen-gutter-y-md) var(--screen-gutter-x-md) 0;
    }
  }

  .app-screen[data-width="form"] {
    max-width: var(--screen-max-form);
  }
  .app-screen[data-width="custom"] {
    max-width: none;
  }

  .app-screen__header {
    flex: 0 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: var(--screen-header-gap);
  }

  .app-screen__titles {
    min-width: 0;
  }

  .app-screen__header h1 {
    font-size: var(--screen-title-size);
    font-weight: 600;
    line-height: 1.2;
    color: var(--color-text-primary);
    margin: 0;
  }

  .app-screen__subtitle {
    font-size: var(--screen-subtitle-size);
    color: var(--screen-subtitle-color);
    margin: 0.25rem 0 0;
  }

  .app-screen__actions {
    flex: 0 0 auto;
  }

  .app-screen__tabs {
    flex: 0 0 auto;
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--color-bg-base);
    margin-bottom: 1rem;
  }

  .app-screen__body {
    flex: 1 1 auto;
    min-height: 0;
    padding-bottom: var(--screen-gutter-y);
  }

  .app-screen__body[data-scroll="true"] {
    overflow-y: auto;
  }
</style>
