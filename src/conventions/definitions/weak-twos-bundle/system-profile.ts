import { createSaycProfile } from "../../core/profile-builder";

export const WEAK_TWO_PROFILE = createSaycProfile({
  profileId: "weak-two-sayc",
  modules: [
    {
      moduleId: "weak-two",
      kind: "add-on",
      attachments: [
        {
          whenAuction: { kind: "sequence", calls: ["2D"] },
        },
        {
          whenAuction: { kind: "sequence", calls: ["2H"] },
        },
        {
          whenAuction: { kind: "sequence", calls: ["2S"] },
        },
      ],
    },
  ],
});
