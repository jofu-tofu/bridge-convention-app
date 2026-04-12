import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import InterferenceSection from "../../../shared/reference/InterferenceSection.svelte";
import { interferenceFixture } from "./test-fixtures";

describe("InterferenceSection", () => {
  it("renders opponent action, response, and note together", () => {
    const { getByText } = render(InterferenceSection, {
      props: {
        items: interferenceFixture,
      },
    });

    expect(getByText("Opponent action")).toBeTruthy();
    expect(getByText("Our action")).toBeTruthy();
    expect(getByText("Pass with weak Stayman hands if systems are off.")).toBeTruthy();
  });
});
