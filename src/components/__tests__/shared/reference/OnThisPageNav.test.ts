import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/svelte";
import OnThisPageNav from "../../../shared/reference/OnThisPageNav.svelte";

interface MockObserverInstance {
  readonly observe: ReturnType<typeof vi.fn>;
  readonly disconnect: ReturnType<typeof vi.fn>;
  readonly trigger: (entries: IntersectionObserverEntry[]) => void;
}

describe("OnThisPageNav", () => {
  const sectionIds = ["summary-card", "response-table"];
  const observed = new Map<Element, MockObserverInstance>();
  const originalObserver = globalThis.IntersectionObserver;

  beforeEach(() => {
    for (const id of sectionIds) {
      const el = document.createElement("section");
      el.id = id;
      document.body.appendChild(el);
    }

    class MockIntersectionObserver {
      readonly observe = vi.fn((element: Element) => {
        observed.set(element, this as unknown as MockObserverInstance);
      });
      readonly disconnect = vi.fn();

      constructor(private readonly callback: IntersectionObserverCallback) {}

      trigger(entries: IntersectionObserverEntry[]) {
        this.callback(entries, this as unknown as IntersectionObserver);
      }
    }

    globalThis.IntersectionObserver = vi
      .fn((callback: IntersectionObserverCallback) => {
        const observer = new MockIntersectionObserver(callback) as unknown as MockObserverInstance;
        return observer as unknown as IntersectionObserver;
      }) as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    observed.clear();
    globalThis.IntersectionObserver = originalObserver;
  });

  it("highlights the section currently intersecting the viewport", async () => {
    const { getByRole } = render(OnThisPageNav, {
      props: {
        sections: [
          { id: "summary-card", label: "Summary" },
          { id: "response-table", label: "Responses" },
        ],
      },
    });

    const responseTarget = document.getElementById("response-table");
    const responseLink = getByRole("link", { name: "Responses" });
    expect(responseLink.getAttribute("aria-current")).not.toBe("true");

    observed.get(responseTarget!)?.trigger([
      {
        target: responseTarget!,
        isIntersecting: true,
        intersectionRatio: 0.8,
        boundingClientRect: responseTarget!.getBoundingClientRect(),
        intersectionRect: responseTarget!.getBoundingClientRect(),
        rootBounds: null,
        time: 0,
      } as IntersectionObserverEntry,
    ]);

    await Promise.resolve();
    expect(responseLink.getAttribute("aria-current")).toBe("true");
  });
});
