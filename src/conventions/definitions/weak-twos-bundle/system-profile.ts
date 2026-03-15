import type { SystemProfileIR } from "../../../core/contracts/agreement-module";
import { defaultPriorityClassMapping } from "../../../core/contracts/agreement-module";

export const WEAK_TWO_PROFILE: SystemProfileIR = {
  profileId: "weak-two-sayc",
  baseSystem: "sayc",
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
  conflictPolicy: { activationDefault: "simultaneous" },
  priorityClassMapping: defaultPriorityClassMapping(),
};
