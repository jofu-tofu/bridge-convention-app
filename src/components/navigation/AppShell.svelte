<script lang="ts">
  import NavRail from "./NavRail.svelte";
  import BottomTabBar from "./BottomTabBar.svelte";

  const { children } = $props();
</script>

<div class="shell">
  <div class="shell-rail"><NavRail /></div>
  <div class="shell-main">{@render children()}</div>
  <div class="shell-tabs"><BottomTabBar /></div>
</div>

<style>
  .shell {
    display: flex;
    width: 100%;
    min-height: 100vh;
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
  }

  .shell-tabs {
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
  }
</style>
