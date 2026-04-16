<script lang="ts">
  import LearnSidebar from "../../../components/learn/LearnSidebar.svelte";

  const { data, children } = $props();
</script>

<div class="learn-shell">
  <LearnSidebar modules={data.sidebarModules} />
  <div class="learn-main">
    {@render children()}
  </div>
</div>

<style>
  .learn-shell {
    width: 100%;
    padding: var(--screen-gutter-y, 1rem) var(--screen-gutter-x, 1rem) 0;
    box-sizing: border-box;
  }

  .learn-main {
    min-width: 0;
  }

  @media (min-width: 1024px) {
    .learn-shell {
      display: grid;
      grid-template-columns: clamp(280px, 22vw, 360px) minmax(0, 1fr);
      gap: clamp(1.25rem, 2vw, 2.5rem);
      padding-inline: 0 clamp(1rem, 3vw, 2.5rem);
      max-width: 1600px;
    }
  }
</style>
