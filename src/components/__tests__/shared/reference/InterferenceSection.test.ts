import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import InterferenceSection from "../../../shared/reference/InterferenceSection.svelte";
import {
  interferenceApplicableFixture,
  interferenceNotApplicableFixture,
} from "./test-fixtures";

describe("InterferenceSection", () => {
  it("renders items when status is applicable", () => {
    const { getByText } = render(InterferenceSection, {
      props: { interference: interferenceApplicableFixture },
    });

    expect(getByText("Opponent action")).toBeTruthy();
    expect(getByText("Our action")).toBeTruthy();
    expect(getByText("Pass with weak Stayman hands if systems are off.")).toBeTruthy();
  });

  it("renders a short sentence with the reason when status is notApplicable", () => {
    const { getByText, queryByText } = render(InterferenceSection, {
      props: { interference: interferenceNotApplicableFixture },
    });

    expect(queryByText("Opponent action")).toBeNull();
    expect(
      getByText(/No interference guidance for this convention/i),
    ).toBeTruthy();
    expect(getByText(/slam-zone ask with no standard opponent overcall/i)).toBeTruthy();
  });
});
