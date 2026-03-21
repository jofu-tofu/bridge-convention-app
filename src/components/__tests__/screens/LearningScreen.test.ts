import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import LearningScreenTestWrapper from "./LearningScreenTestWrapper.svelte";
import { createAppStore } from "../../../stores/app.svelte";
import { createGameStore } from "../../../stores/game.svelte";
import { createStubEngine } from "../../../test-support/engine-stub";
import { createLocalService } from "../../../service";
import { ntBundle } from "../../../conventions/definitions/nt-bundle";
import { bergenBundle } from "../../../conventions/definitions/bergen-bundle";
import { clearBundleRegistry, registerBundle, createConventionConfigFromBundle } from "../../../conventions/core/bundle";

const ntBundleConventionConfig = createConventionConfigFromBundle(ntBundle);

describe("LearningScreen", () => {
  beforeEach(() => {
    clearBundleRegistry();
    registerBundle(ntBundle);
    registerBundle(bergenBundle);
  });

  function renderLearningScreen() {
    const engine = createStubEngine();
    const gameStore = createGameStore(engine, createLocalService(engine));
    const appStore = createAppStore();
    appStore.navigateToLearning(ntBundleConventionConfig);

    render(LearningScreenTestWrapper, {
      props: { engine, gameStore, appStore },
    });

    return { appStore };
  }

  it("renders the convention name in the heading", () => {
    renderLearningScreen();
    expect(screen.getByRole("heading", { name: "1NT Responses", level: 1 })).toBeTruthy();
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
    // Both registered conventions should appear in sidebar
    expect(screen.getByRole("button", { name: "1NT Responses" })).toBeTruthy();
  });

  it("shows quick reference content for NT bundle", () => {
    renderLearningScreen();
    expect(screen.getByText("Quick Reference")).toBeTruthy();
    expect(screen.getByText(/After partner opens 1NT \(15-17 HCP\)/i)).toBeTruthy();
  });

  it("has a practice button in the convention toolbar", () => {
    renderLearningScreen();
    expect(
      screen.getByRole("button", { name: /practice/i }),
    ).toBeTruthy();
  });

  it("practice button navigates to game screen", async () => {
    const { appStore } = renderLearningScreen();
    const btn = screen.getByRole("button", { name: /^practice$/i });
    await fireEvent.click(btn);
    expect(appStore.screen).toBe("game");
  });

  it("renders depth mode tabs", () => {
    renderLearningScreen();
    const tablist = screen.getByRole("tablist", { name: /detail level/i });
    expect(tablist).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Compact" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Study" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Learn" })).toBeTruthy();
  });

  it("defaults to Study mode tab selected", () => {
    renderLearningScreen();
    const studyTab = screen.getByRole("tab", { name: "Study" });
    expect(studyTab.getAttribute("aria-selected")).toBe("true");
  });

  it("switching tabs updates the selected tab", async () => {
    renderLearningScreen();
    const compactTab = screen.getByRole("tab", { name: "Compact" });
    await fireEvent.click(compactTab);
    expect(compactTab.getAttribute("aria-selected")).toBe("true");

    const studyTab = screen.getByRole("tab", { name: "Study" });
    expect(studyTab.getAttribute("aria-selected")).toBe("false");
  });

  it("shows convention description as summary", () => {
    renderLearningScreen();
    expect(screen.getByText("About This Convention")).toBeTruthy();
    expect(screen.getByText("Summary")).toBeTruthy();
  });
});
