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
    const { getByLabelText, getByText } = render(WorkedAuctionCard, {
      props: {
        moduleId: "stayman",
        auction: workedAuctionWithHandFixture,
      },
    });

    expect(
      getByLabelText("Responder hand for Main Line — find the heart fit"),
    ).toBeTruthy();
    expect(getByText("K97")).toBeTruthy();
    expect(getByText("AJ53")).toBeTruthy();
  });
});
