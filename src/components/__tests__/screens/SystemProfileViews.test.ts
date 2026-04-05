import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import { SAYC_SYSTEM_CONFIG } from "../../../service/session-types";
import SystemDetailView from "../../screens/SystemDetailView.svelte";
import SystemCompareView from "../../screens/SystemCompareView.svelte";

describe("SystemDetailView", () => {
  it("shows HCP and trump total points without a separate NT total-points column", () => {
    const { container } = render(SystemDetailView, {
      props: { config: SAYC_SYSTEM_CONFIG },
    });

    expect(container.textContent).toContain("Trump TP");
    expect(container.textContent).not.toContain("NT TP");
  });
});

describe("SystemCompareView", () => {
  it("shows HCP and trump comparison rows without an NT row", () => {
    const { container } = render(SystemCompareView);

    expect(container.textContent).toContain("Trump Invite Range");
    expect(container.textContent).not.toContain("NT Invite Range");
  });
});
