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
        <img src="/favicon.svg" alt="" />
      </a>
    </header>
    {@render children()}
  </div>
  <div class="shell-tabs"><BottomTabBar /></div>
</div>

<style>
  .shell {
    display: flex;
    width: 100%;
    height: 100%;
  }

  .shell-rail {
    flex-shrink: 0;
  }

  .shell-main {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .shell-tabs {
    display: none;
  }

  .shell-topbar {
    display: none;
  }

  @media (max-width: 1023px) {
    .shell {
      flex-direction: column;
    }
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
