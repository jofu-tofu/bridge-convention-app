import type { SystemProfileIR } from "../../../core/contracts/agreement-module";

export const BERGEN_PROFILE: SystemProfileIR = {
  profileId: "bergen-sayc",
  baseSystem: "sayc",
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
  conflictPolicy: { activationDefault: "simultaneous" },
};
