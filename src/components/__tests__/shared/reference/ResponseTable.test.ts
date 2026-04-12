import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import ResponseTable from "../../../shared/reference/ResponseTable.svelte";
import { responseTableFixture } from "./test-fixtures";

describe("ResponseTable", () => {
  it("renders the fixed schema and stable row anchors", () => {
    const { container, getByText } = render(ResponseTable, {
      props: {
        moduleId: "stayman",
        rows: responseTableFixture,
      },
    });

    expect(getByText("Response")).toBeTruthy();
    expect(getByText("Meaning")).toBeTruthy();
    expect(getByText("Shape")).toBeTruthy();
    expect(getByText("HCP")).toBeTruthy();
    expect(getByText("Forcing?")).toBeTruthy();

    const row = container.querySelector("#stayman-ask-major");
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain("NF");
  });
});
