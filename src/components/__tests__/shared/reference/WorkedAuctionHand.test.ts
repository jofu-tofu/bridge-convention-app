import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import WorkedAuctionCard from "../../../shared/reference/WorkedAuctionCard.svelte";
import {
  workedAuctionFixture,
  workedAuctionWithHandFixture,
} from "./test-fixtures";

describe("WorkedAuctionCard", () => {
  it("renders the annotated worked auction", () => {
    const { getByText } = render(WorkedAuctionCard, {
      props: {
        moduleId: "stayman",
        auction: workedAuctionFixture,
      },
    });

    expect(getByText("Main Line — find the heart fit")).toBeTruthy();
    expect(
      getByText("Responder places the contract in game with the fit located."),
    ).toBeTruthy();
  });

  it("renders the responder hand diagram when hand data is present", () => {
    const { getByLabelText } = render(WorkedAuctionCard, {
      props: {
        moduleId: "stayman",
        auction: workedAuctionWithHandFixture,
      },
    });

    expect(
      getByLabelText("Responder hand for Main Line — find the heart fit"),
    ).toBeTruthy();
    expect(getByLabelText("K of spades")).toBeTruthy();
    expect(getByLabelText("9 of spades")).toBeTruthy();
    expect(getByLabelText("7 of spades")).toBeTruthy();
    expect(getByLabelText("A of hearts")).toBeTruthy();
    expect(getByLabelText("J of hearts")).toBeTruthy();
    expect(getByLabelText("5 of hearts")).toBeTruthy();
    expect(getByLabelText("3 of hearts")).toBeTruthy();
  });
});
