import type { SystemProfileIR } from "../../../core/contracts/agreement-module";
import { defaultPriorityClassMapping } from "../../../core/contracts/agreement-module";

export const DONT_PROFILE: SystemProfileIR = {
  profileId: "dont-sayc",
  baseSystem: "sayc",
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
  conflictPolicy: { activationDefault: "simultaneous" },
  priorityClassMapping: defaultPriorityClassMapping(),
};
