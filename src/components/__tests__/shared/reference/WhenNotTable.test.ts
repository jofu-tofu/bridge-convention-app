import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/svelte";
import WhenNotTable from "../../../shared/reference/WhenNotTable.svelte";
import { whenNotToUseFixture, whenToUseFixture } from "./test-fixtures";
import type {
  ReferencePredicateBullet,
  ReferenceWhenNotItem,
} from "../../../shared/reference/types";

describe("WhenNotTable", () => {
  it("renders positive and negative usage guidance with predicate disclosures", async () => {
    const { getByRole, getByText } = render(WhenNotTable, {
      props: {
        whenToUse: whenToUseFixture,
        whenNotToUse: whenNotToUseFixture,
      },
    });

    expect(getByText("When to use")).toBeTruthy();
    expect(getByText("When not to use")).toBeTruthy();
    expect(
      getByText("Do not use Stayman with 4-3-3-3 and a 4-card major"),
    ).toBeTruthy();
    expect(getByText("(there is no ruffing value to justify searching for a thin fit)")).toBeTruthy();

    await fireEvent.click(getByRole("button", { name: "Show condition for: Invite or force after a 1NT opening when you hold at least one 4-card major." }));
    expect(
      getByText("Responder has invitational-or-better values and at least one 4-card major."),
    ).toBeTruthy();
  });

  it("hides when-to-use bullets whose gloss is empty instead of rendering a placeholder", () => {
    const emptyGloss: readonly ReferencePredicateBullet[] = [
      { predicate: {}, gloss: "" },
    ];
    const { queryByText, container } = render(WhenNotTable, {
      props: { whenToUse: emptyGloss, whenNotToUse: [] },
    });
    expect(queryByText("Condition text pending")).toBeNull();
    expect(container.querySelectorAll("li").length).toBe(0);
  });

  it("omits the parenthetical reason on when-not-to-use bullets when the reason is empty", () => {
    const items: readonly ReferenceWhenNotItem[] = [
      { text: "Do not use without agreement", reason: "" },
    ];
    const { queryByText, getByText } = render(WhenNotTable, {
      props: { whenToUse: [], whenNotToUse: items },
    });
    expect(getByText("Do not use without agreement")).toBeTruthy();
    expect(queryByText("()")).toBeNull();
  });
});
