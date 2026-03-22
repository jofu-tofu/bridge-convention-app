import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/svelte";
import AppShell from "../../../AppShell.svelte";
import { createAppStore } from "../../../stores/app.svelte";
import { createGameStore } from "../../../stores/game.svelte";
import { createStubEngine } from "../../../test-support/engine-stub";
import { createLocalService } from "../../../service";
import { clearBundleRegistry, registerBundle, createConventionConfigFromBundle, ntBundle } from "../../../conventions";

const ntBundleConventionConfig = createConventionConfigFromBundle(ntBundle);

describe("AppShell", () => {
  beforeEach(() => {
    clearBundleRegistry();
    registerBundle(ntBundle);
  });

  function renderShell() {
    const engine = createStubEngine();
    const service = createLocalService(engine);
    const gameStore = createGameStore(engine, service);
    const appStore = createAppStore();
    render(AppShell, { props: { engine, service, gameStore, appStore } });
    return { appStore, gameStore };
  }

  it("sets context and renders convention select screen by default", () => {
    renderShell();
    expect(screen.getByText("Bridge Practice")).toBeTruthy();
  });

  it("navigating to game screen does not reset debug panel state", () => {
    const { appStore } = renderShell();

    // Simulate what applyDevParams does: set debug panel on
    appStore.setDebugPanel(true);
    expect(appStore.debugPanelOpen).toBe(true);

    // Navigate to game (this is what caused the $effect to re-run)
    appStore.selectConvention(ntBundleConventionConfig);
    expect(appStore.screen).toBe("game");

    // Debug panel should still be on — not reset by re-running URL params
    expect(appStore.debugPanelOpen).toBe(true);
  });

  it("navigating between screens preserves autoplay state", () => {
    const { appStore } = renderShell();

    appStore.setAutoplay(true);
    appStore.selectConvention(ntBundleConventionConfig);
    expect(appStore.autoplay).toBe(true);

    appStore.navigateToMenu();
    expect(appStore.autoplay).toBe(true);
  });
});
