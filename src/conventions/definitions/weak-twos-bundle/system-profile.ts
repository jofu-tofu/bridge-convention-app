import { createSystemProfile } from "../../core/profile-builder";
import { BASE_SYSTEM_SAYC } from "../system-config";

export const WEAK_TWO_PROFILE = createSystemProfile({
  baseSystem: BASE_SYSTEM_SAYC,
  profileId: "weak-two-sayc",
  modules: [
    {
      moduleId: "weak-twos",
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
