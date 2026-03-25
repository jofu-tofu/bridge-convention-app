import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import ConventionCard from "../../game/ConventionCard.svelte";
import { buildConventionCard, getSystemConfig } from "../../../service";

const saycConfig = getSystemConfig("sayc");
const acolConfig = getSystemConfig("acol");

describe("ConventionCard", () => {
  it("renders CC trigger button", () => {
    const cards = [
      buildConventionCard(saycConfig, "N-S"),
      buildConventionCard(saycConfig, "E-W"),
    ] as const;
    const { getByTestId } = render(ConventionCard, { props: { cards } });
    expect(getByTestId("convention-card-trigger")).toBeTruthy();
    expect(getByTestId("convention-card-trigger").textContent).toBe("CC");
  });

  it("popover hidden by default (opacity-0)", () => {
    const cards = [
      buildConventionCard(saycConfig, "N-S"),
      buildConventionCard(saycConfig, "E-W"),
    ] as const;
    const { getByTestId } = render(ConventionCard, { props: { cards } });
    const popover = getByTestId("convention-card-popover");
    expect(popover.classList.contains("opacity-0")).toBe(true);
  });

  it("pins popover open on click", async () => {
    const cards = [
      buildConventionCard(saycConfig, "N-S"),
      buildConventionCard(acolConfig, "E-W"),
    ] as const;
    const { getByTestId, getByText } = render(ConventionCard, { props: { cards } });
    await fireEvent.click(getByTestId("convention-card-trigger"));
    const popover = getByTestId("convention-card-popover");
    expect(popover.classList.contains("cc-pinned")).toBe(true);
    expect(getByText("N-S")).toBeTruthy();
    expect(getByText("E-W")).toBeTruthy();
    expect(getByText("SAYC")).toBeTruthy();
    expect(getByText("Acol")).toBeTruthy();
  });

  it("displays NT range in popover", () => {
    const cards = [
      buildConventionCard(saycConfig, "N-S"),
      buildConventionCard(acolConfig, "E-W"),
    ] as const;
    const { getByTestId } = render(ConventionCard, { props: { cards } });
    const text = getByTestId("convention-card-popover").textContent ?? "";
    expect(text).toContain("1NT: 15\u201317");
    expect(text).toContain("1NT: 12\u201314");
  });
});
