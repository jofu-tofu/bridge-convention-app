import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import { SAYC_SYSTEM_CONFIG } from "../../../service/session-types";
import SystemDetailView from "../../screens/SystemDetailView.svelte";
import SystemCompareView from "../../screens/SystemCompareView.svelte";

describe("SystemDetailView", () => {
  it("shows NT/HCP and Suit/TP headers without a separate NT total-points column", () => {
    const { container } = render(SystemDetailView, {
      props: { config: SAYC_SYSTEM_CONFIG },
    });
    const text = container.textContent?.replace(/\s+/g, " ") ?? "";

    expect(text).toContain("NT / HCP");
    expect(text).toContain("Suit / TP");
    expect(text).not.toContain("NT TP");
  });
});

describe("SystemCompareView", () => {
  it("shows NT/HCP and Suit/TP comparison rows without an NT row", () => {
    const { container } = render(SystemCompareView);
    const text = container.textContent?.replace(/\s+/g, " ") ?? "";

    expect(text).toContain("NT / HCP Invite Range");
    expect(text).toContain("Suit / TP Invite Range");
    expect(text).not.toContain("NT Invite Range");
  });
});
