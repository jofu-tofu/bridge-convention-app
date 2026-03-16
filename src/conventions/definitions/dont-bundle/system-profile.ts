import { createSaycProfile } from "../../core/profile-builder";

export const DONT_PROFILE = createSaycProfile({
  profileId: "dont-sayc",
  modules: [
    {
      moduleId: "dont",
      kind: "add-on",
      attachments: [
        {
          whenAuction: { kind: "sequence", calls: ["1NT"] },
        },
      ],
    },
  ],
});
