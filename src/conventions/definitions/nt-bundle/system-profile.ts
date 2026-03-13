import type { SystemProfileIR } from "../../../core/contracts/agreement-module";

export const NT_SAYC_PROFILE: SystemProfileIR = {
  profileId: "1nt-sayc",
  baseSystem: "sayc",
  modules: [
    {
      moduleId: "natural-nt",
      kind: "base-system",
      attachments: [{ whenAuction: { kind: "sequence", calls: ["1NT"] } }],
    },
    {
      moduleId: "stayman",
      kind: "add-on",
      attachments: [{
        whenAuction: { kind: "sequence", calls: ["1NT"] },
        requiresCapabilities: ["ntOpenerContext"],
      }],
    },
    {
      moduleId: "jacoby-transfers",
      kind: "add-on",
      attachments: [{
        whenAuction: { kind: "sequence", calls: ["1NT"] },
        requiresCapabilities: ["ntOpenerContext"],
      }],
    },
  ],
  conflictPolicy: { activationDefault: "simultaneous" },
};
