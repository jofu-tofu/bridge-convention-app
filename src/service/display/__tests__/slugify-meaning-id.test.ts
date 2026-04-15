import { describe, expect, it } from "vitest";
import { slugifyMeaningId } from "../util/slugify-meaning-id";

describe("slugifyMeaningId", () => {
  it("drops the duplicated module prefix when the meaning id already starts with it", () => {
    expect(slugifyMeaningId("stayman", "stayman:ask-major")).toBe("stayman-ask-major");
  });

  it("prefixes the module id when the meaning id does not already include it", () => {
    expect(slugifyMeaningId("stayman", "response-2d")).toBe("stayman-response-2d");
  });

  it("replaces every colon in nested meaning ids", () => {
    expect(slugifyMeaningId("jacoby-transfers", "invite:accept:hearts")).toBe(
      "jacoby-transfers-invite-accept-hearts",
    );
  });
});
