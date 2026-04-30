import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import ResponseTable from "../../../shared/reference/ResponseTable.svelte";
import { responseTableFixture } from "./test-fixtures";

describe("ResponseTable", () => {
  it("renders dynamic columns from the viewport and stable row anchors", () => {
    const { container, getByText } = render(ResponseTable, {
      props: {
        moduleId: "stayman",
        responseTable: responseTableFixture,
      },
    });

    expect(getByText("Bid")).toBeTruthy();
    expect(getByText("Meaning")).toBeTruthy();
    // Dynamic columns from the viewport
    expect(getByText("Shape")).toBeTruthy();
    expect(getByText("HCP")).toBeTruthy();

    const row = container.querySelector("#stayman-ask-major");
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain("Balanced without a 4-card major.");
  });

  it("renders only the columns present in the viewport (single-column case)", () => {
    const { queryByText, getByText } = render(ResponseTable, {
      props: {
        moduleId: "stayman",
        responseTable: {
          columns: [{ id: "shape", label: "Shape" }],
          rows: [
            {
              meaningId: "stayman:show-hearts",
              response: "2H",
              meaning: "Shows four hearts.",
              cells: [{ columnId: "shape", columnLabel: "Shape", text: "4+ hearts" }],
            },
          ],
        },
      },
    });

    expect(getByText("Shape")).toBeTruthy();
    expect(queryByText("HCP")).toBeNull();
    expect(queryByText("Forcing?")).toBeNull();
  });
});
