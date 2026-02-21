import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import ConventionCallout from "../../shared/ConventionCallout.svelte";

describe("ConventionCallout", () => {
  it("renders rule name in badge", () => {
    const { container } = render(ConventionCallout, {
      props: { ruleName: "stayman-ask", explanation: "Asking for major" },
    });
    expect(container.textContent).toContain("stayman-ask");
  });

  it("renders explanation text", () => {
    const { container } = render(ConventionCallout, {
      props: { ruleName: "stayman-ask", explanation: "Asking for major" },
    });
    expect(container.textContent).toContain("Asking for major");
  });
});
