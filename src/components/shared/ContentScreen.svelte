<script lang="ts">
  import type { Snippet } from "svelte";

  type Width = "wide" | "narrow";

  interface Props {
    title?: string;
    subtitle?: string;
    width?: Width;
    actions?: Snippet;
    aside?: Snippet;
    contentClass?: string;
    children: Snippet;
  }

  const {
    title,
    subtitle,
    width = "wide",
    actions,
    aside,
    contentClass,
    children,
  }: Props = $props();
</script>

<section class="content-screen" data-width={width} class:has-aside={!!aside}>
  {#if title}
    <header class="content-screen__header">
      <div class="content-screen__titles">
        <h1>{title}</h1>
        {#if subtitle}<p class="content-screen__subtitle">{subtitle}</p>{/if}
      </div>
      {#if actions}
        <div class="content-screen__actions">{@render actions()}</div>
      {/if}
    </header>
  {/if}

  {#if aside}
    <div class="content-screen__grid">
      <aside class="content-screen__aside">{@render aside()}</aside>
      <div class="content-screen__body {contentClass ?? ''}">
        {@render children()}
      </div>
    </div>
  {:else}
    <div class="content-screen__body {contentClass ?? ''}">
      {@render children()}
    </div>
  {/if}
</section>

<style>
  .content-screen {
    width: 100%;
    max-width: var(--screen-max-content);
    margin: 0 auto;
    padding: var(--screen-gutter-y) var(--screen-gutter-x) var(--screen-gutter-y);
  }

  .content-screen[data-width="narrow"] {
    max-width: var(--screen-max-content-narrow);
  }

  .content-screen.has-aside[data-width="narrow"] {
    max-width: calc(var(--screen-max-content-narrow) + 240px);
  }

  @media (min-width: 640px) {
    .content-screen {
      padding: var(--screen-gutter-y-md) var(--screen-gutter-x-md);
    }
  }

  @media (min-width: 1024px) {
    .content-screen {
      margin-left: calc(var(--rail-width, 80px) + 1rem);
      margin-right: auto;
      max-width: calc(100vw - var(--rail-width, 80px) - 2rem);
    }
    .content-screen[data-width="narrow"] {
      max-width: min(
        var(--screen-max-content-narrow),
        calc(100vw - var(--rail-width, 80px) - 2rem)
      );
    }
    .content-screen[data-width="wide"] {
      max-width: min(
        var(--screen-max-content),
        calc(100vw - var(--rail-width, 80px) - 2rem)
      );
    }
  }

  .content-screen__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: var(--screen-header-gap);
  }

  .content-screen__titles {
    min-width: 0;
  }

  .content-screen__header h1 {
    font-size: var(--screen-title-size);
    font-weight: 600;
    line-height: 1.2;
    color: var(--color-text-primary);
    margin: 0;
  }

  .content-screen__subtitle {
    font-size: var(--screen-subtitle-size);
    color: var(--screen-subtitle-color);
    margin: 0.25rem 0 0;
  }

  .content-screen__grid {
    display: block;
  }

  @media (min-width: 1024px) {
    .content-screen__grid {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr);
      gap: 2rem;
      align-items: start;
    }
    .content-screen__aside {
      position: sticky;
      top: 4rem;
      align-self: start;
    }
  }
</style>
