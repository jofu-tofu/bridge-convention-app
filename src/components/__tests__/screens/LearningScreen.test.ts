import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
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
    const gameStore = createGameStore(service);
    const appStore = createAppStore();
    appStore.navigateToLearning(ntBundleConventionConfig);

    render(LearningScreenTestWrapper, {
      props: { engine, gameStore, appStore, service },
    });

    return { appStore };
  }

  it("renders the selected module name in the heading", async () => {
    renderLearningScreen();
    // navigateToLearning auto-selects the first module (stayman, since natural-bids is base-only)
    expect(await screen.findByRole("heading", { name: /Stayman/, level: 1 })).toBeTruthy();
  });

  it("has a Learn header", () => {
    renderLearningScreen();
    expect(
      screen.getByText("Learn"),
    ).toBeTruthy();
  });

  it("sidebar renders module list", async () => {
    renderLearningScreen();
    const nav = screen.getByRole("navigation", { name: /convention list/i });
    expect(nav).toBeTruthy();
    // NT bundle modules should be listed
    expect(await screen.findByTestId("module-stayman")).toBeTruthy();
    expect(await screen.findByTestId("module-jacoby-transfers")).toBeTruthy();
  });

  it("shows module description", async () => {
    renderLearningScreen();
    // First module (stayman) description should appear (♣ is the formatted suit symbol)
    expect(await screen.findByText(/over 1NT/i)).toBeTruthy();
  });

  it("shows teaching content", async () => {
    renderLearningScreen();
    // stayman has a principle
    expect(await screen.findByText(/Principle/)).toBeTruthy();
  });

  it("shows surfaces grouped by phase", async () => {
    renderLearningScreen();
    // stayman has phases visible in conversation flow
    expect(await screen.findByText(/Bidding Conversation/i)).toBeTruthy();
  });

  it("has a practice button", async () => {
    renderLearningScreen();
    expect(await screen.findByRole("button", { name: /^practice$/i })).toBeTruthy();
  });

  it("clicking a module in sidebar shows its content", async () => {
    renderLearningScreen();
    const staymanBtn = await screen.findByTestId("module-stayman");
    await fireEvent.click(staymanBtn);
    // Stayman module content should now show
    expect(await screen.findByRole("heading", { name: /Stayman/, level: 1 })).toBeTruthy();
    // Stayman has teaching tradeoff
    expect(await screen.findByText(/Tradeoff/)).toBeTruthy();
  });
});
