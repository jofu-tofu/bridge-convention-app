import { createSaycProfile } from "../../core/profile-builder";

export const BERGEN_PROFILE = createSaycProfile({
  profileId: "bergen-sayc",
  modules: [
    {
      moduleId: "bergen",
      kind: "add-on",
      attachments: [{
        whenAuction: { kind: "sequence", calls: ["1H"] },
      }, {
        whenAuction: { kind: "sequence", calls: ["1S"] },
      }],
    },
  ],
});
