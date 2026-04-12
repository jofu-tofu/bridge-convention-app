<script lang="ts">
  import NavRail from "./NavRail.svelte";
  import BottomTabBar from "./BottomTabBar.svelte";

  const { children } = $props();
</script>

<div class="shell">
  <div class="shell-rail"><NavRail /></div>
  <div class="shell-main">
    <header class="shell-topbar">
      <a href="/" aria-label="BridgeLab home" class="shell-logo">
        <img src="/brand/logo.svg" alt="" />
      </a>
    </header>
    {@render children()}
  </div>
  <div class="shell-tabs"><BottomTabBar /></div>
</div>

<style>
  .shell {
    --rail-width: 80px;
    position: relative;
    width: 100%;
    height: 100%;
  }

  .shell-rail {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: var(--rail-width);
    z-index: 40;
  }

  .shell-main {
    height: 100%;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  @media (min-width: 1024px) {
    .shell-main {
      padding-inline-start: calc(var(--rail-width) + 1rem);
    }
  }

  .shell-tabs {
    display: none;
  }

  .shell-topbar {
    display: none;
  }

  @media (max-width: 1023px) {
    .shell-rail {
      display: none;
    }
    .shell-tabs {
      display: block;
      position: sticky;
      bottom: 0;
      z-index: 50;
    }
    .shell-topbar {
      display: flex;
      align-items: center;
      height: 48px;
      padding: 0 1rem;
      border-bottom: 1px solid var(--color-border-subtle);
      background: var(--color-bg-base);
      flex-shrink: 0;
    }
    .shell-logo {
      display: inline-flex;
    }
    .shell-logo img {
      width: 28px;
      height: 28px;
    }
  }
</style>
