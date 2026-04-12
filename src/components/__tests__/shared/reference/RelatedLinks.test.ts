import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import RelatedLinks from "../../../shared/reference/RelatedLinks.svelte";
import { relatedLinksFixture } from "./test-fixtures";

describe("RelatedLinks", () => {
  it("renders labeled cross-links with discriminators", () => {
    const { container, getByText } = render(RelatedLinks, {
      props: {
        links: relatedLinksFixture,
      },
    });

    expect(getByText("Jacoby Transfers")).toBeTruthy();
    expect(
      getByText(/asks for a major directly instead of asking whether opener has one/i),
    ).toBeTruthy();
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/learn/jacoby-transfers/");
  });
});
