import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import LearningScreenTestWrapper from "./LearningScreenTestWrapper.svelte";
import { createAppStore } from "../../../stores/app.svelte";
import { createGameStore } from "../../../stores/game.svelte";
import { createStubEngine } from "../../../test-support/engine-stub";
import { staymanConfig } from "../../../conventions/definitions/stayman";
import {
  clearRegistry,
  registerConvention,
} from "../../../conventions/core/registry";
import { gerberConfig } from "../../../conventions/definitions/gerber";
import { saycConfig } from "../../../conventions/definitions/sayc";

describe("LearningScreen", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
    registerConvention(gerberConfig);
    registerConvention(saycConfig);
  });

  function renderLearningScreen() {
    const engine = createStubEngine();
    const gameStore = createGameStore(engine);
    const appStore = createAppStore();
    appStore.navigateToLearning(staymanConfig);

    render(LearningScreenTestWrapper, {
      props: { engine, gameStore, appStore },
    });

    return { appStore };
  }

  it("renders the convention name in the heading", () => {
    renderLearningScreen();
    expect(screen.getByRole("heading", { name: "Stayman", level: 1 })).toBeTruthy();
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
    // All three registered conventions should appear in sidebar
    expect(screen.getByRole("button", { name: "Stayman" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gerber" })).toBeTruthy();
  });

  it("has a Decision Tree section", () => {
    renderLearningScreen();
    expect(screen.getByText("Decision Tree")).toBeTruthy();
    expect(screen.getByRole("tree")).toBeTruthy();
  });

  it("has a practice button", () => {
    renderLearningScreen();
    expect(
      screen.getByRole("button", { name: /practice this convention/i }),
    ).toBeTruthy();
  });

  it("practice button navigates to game screen", async () => {
    const { appStore } = renderLearningScreen();
    const btn = screen.getByRole("button", { name: /practice this convention/i });
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

  it("shows convention teaching header in Study mode", () => {
    renderLearningScreen();
    // Stayman has convention teaching with purpose
    expect(screen.getByText("About This Convention")).toBeTruthy();
    expect(screen.getByText("Purpose")).toBeTruthy();
  });

  it("hides convention teaching header in Compact mode", async () => {
    renderLearningScreen();
    const compactTab = screen.getByRole("tab", { name: "Compact" });
    await fireEvent.click(compactTab);
    expect(screen.queryByText("About This Convention")).toBeNull();
  });

  it("shows tradeoff in Learn mode but not Study", async () => {
    renderLearningScreen();
    // In Study mode (default), tradeoff should not appear
    expect(screen.queryByText("Tradeoff")).toBeNull();

    // Switch to Learn
    const learnTab = screen.getByRole("tab", { name: "Learn" });
    await fireEvent.click(learnTab);
    expect(screen.getByText("Tradeoff")).toBeTruthy();
  });
});
