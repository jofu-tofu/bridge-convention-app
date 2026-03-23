import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import LearningScreenTestWrapper from "./LearningScreenTestWrapper.svelte";
import { createAppStore } from "../../../stores/app.svelte";
import { createGameStore } from "../../../stores/game.svelte";
import { createStubEngine } from "../../../test-support/engine-stub";
import { createLocalService } from "../../../service";
import { ntBundle, bergenBundle, clearBundleRegistry, registerBundle, createConventionConfigFromBundle } from "../../../conventions";

const ntBundleConventionConfig = createConventionConfigFromBundle(ntBundle);

describe("LearningScreen", () => {
  beforeEach(() => {
    clearBundleRegistry();
    registerBundle(ntBundle);
    registerBundle(bergenBundle);
  });

  function renderLearningScreen() {
    const engine = createStubEngine();
    const service = createLocalService(engine);
    const gameStore = createGameStore(engine, service);
    const appStore = createAppStore();
    appStore.navigateToLearning(ntBundleConventionConfig);

    render(LearningScreenTestWrapper, {
      props: { engine, gameStore, appStore, service },
    });

    return { appStore };
  }

  it("renders the convention name in the heading", async () => {
    renderLearningScreen();
    expect(await screen.findByRole("heading", { name: "1NT Responses", level: 1 })).toBeTruthy();
  });

  it("has a back button", () => {
    renderLearningScreen();
    expect(
      screen.getByRole("button", { name: /back/i }),
    ).toBeTruthy();
  });

  it("sidebar renders multiple convention names", () => {
    renderLearningScreen();
    const nav = screen.getByRole("navigation", { name: /convention list/i });
    expect(nav).toBeTruthy();
    expect(screen.getByRole("button", { name: "1NT Responses" })).toBeTruthy();
  });

  it("shows convention description", async () => {
    renderLearningScreen();
    expect(await screen.findByText(/Full 1NT response system/i)).toBeTruthy();
  });

  it("shows convention purpose", async () => {
    renderLearningScreen();
    expect(await screen.findByText(/Find the best contract after partner opens 1NT/i)).toBeTruthy();
  });

  it("has a practice button", async () => {
    renderLearningScreen();
    expect(await screen.findByRole("button", { name: /^practice$/i })).toBeTruthy();
  });

  it("practice button navigates to game screen", async () => {
    const { appStore } = renderLearningScreen();
    const btn = await screen.findByRole("button", { name: /^practice$/i });
    await fireEvent.click(btn);
    expect(appStore.screen).toBe("game");
  });

  it("shows module cards for multi-module bundles", async () => {
    renderLearningScreen();
    expect(await screen.findByText("Conventions in this bundle")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: /Stayman/, level: 3 })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: /Jacoby Transfers/, level: 3 })).toBeTruthy();
  });
});
