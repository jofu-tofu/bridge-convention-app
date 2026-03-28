import { describe, it, expect } from "vitest";
import { NT_SAYC_PROFILE } from "../system-profile";

describe("NT_SAYC_PROFILE", () => {
  it("has correct profileId", () => {
    expect(NT_SAYC_PROFILE.profileId).toBe("1nt-sayc");
  });

  it("has 3 modules (natural-bids is base-only, not in profile)", () => {
    expect(NT_SAYC_PROFILE.modules).toHaveLength(3);
  });

  it("contains all expected moduleIds", () => {
    const ids = NT_SAYC_PROFILE.modules.map((m) => m.moduleId);
    expect(ids).toEqual(["stayman", "jacoby-transfers", "smolen"]);
  });

});
