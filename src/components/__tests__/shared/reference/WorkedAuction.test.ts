import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import WorkedAuction from "../../../shared/reference/WorkedAuction.svelte";
import { workedAuctionFixture } from "./test-fixtures";

describe("WorkedAuction", () => {
  it("renders the annotated auction grid", () => {
    const { container, getByText } = render(WorkedAuction, {
      props: {
        moduleId: "stayman",
        auction: workedAuctionFixture,
      },
    });

    expect(getByText("Main Line — find the heart fit")).toBeTruthy();
    expect(
      getByText("Responder places the contract in game with the fit located."),
    ).toBeTruthy();
    expect(container.querySelector("#stayman-ask-major")).not.toBeNull();
  });
});
