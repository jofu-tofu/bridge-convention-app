import { createSystemProfile } from "../../core/profile-builder";
import { BASE_SYSTEM_SAYC } from "../../../core/contracts/base-system-vocabulary";

export const BERGEN_PROFILE = createSystemProfile({
  baseSystem: BASE_SYSTEM_SAYC,
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
