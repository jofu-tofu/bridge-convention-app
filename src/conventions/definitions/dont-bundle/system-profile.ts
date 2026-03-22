import { createSystemProfile } from "../../core/profile-builder";
import { BASE_SYSTEM_SAYC } from "../../../core/contracts/base-system-vocabulary";

export const DONT_PROFILE = createSystemProfile({
  baseSystem: BASE_SYSTEM_SAYC,
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
