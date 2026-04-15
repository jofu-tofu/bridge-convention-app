import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/svelte";
import ContinuationList from "../../../shared/reference/ContinuationList.svelte";
import { flowTreeFixture } from "./test-fixtures";

describe("ContinuationList", () => {
  it("shows the first continuation level by default and expands follow-ups on demand", async () => {
    const tree = {
      ...flowTreeFixture,
      root: {
        ...flowTreeFixture.root,
        children: [
          {
            ...flowTreeFixture.root.children[0]!,
            children: [
              {
                ...flowTreeFixture.root.children[0]!.children[0]!,
                children: [
                  {
                    ...flowTreeFixture.root.children[0]!.children[0]!,
                    id: "stayman:4h:4",
                    callDisplay: "4H",
                    meaningId: "stayman:place-hearts-game",
                    label: "Place the contract in hearts",
                    children: [],
                  },
                ],
              },
              ...flowTreeFixture.root.children[0]!.children.slice(1),
            ],
          },
        ],
      },
    };

    const { container, getByRole, getByText } = render(ContinuationList, {
      props: { moduleId: "stayman", tree },
    });

    expect(getByText("Deny major (2♦)")).toBeTruthy();
    expect(getByText("Show hearts")).toBeTruthy();
    expect(container.querySelector("#stayman-heart-fit")).not.toBeNull();
    expect(container.querySelector("details[data-node-id='stayman:2d:2']")?.hasAttribute("open")).toBe(
      false,
    );

    await fireEvent.click(getByRole("button", { name: "Expand all follow-ups" }));
    expect(container.querySelector("details[data-node-id='stayman:2d:2']")?.hasAttribute("open")).toBe(
      true,
    );
    expect(getByText("Place the contract in hearts")).toBeTruthy();
  });
});
