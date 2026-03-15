import type { SystemProfileIR } from "../../../core/contracts/agreement-module";
import { defaultPriorityClassMapping } from "../../../core/contracts/agreement-module";
import { CAP_OPENING_1NT } from "../../../core/contracts/capability-vocabulary";

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
        requiresCapabilities: [CAP_OPENING_1NT],
      }],
    },
    {
      moduleId: "jacoby-transfers",
      kind: "add-on",
      attachments: [{
        whenAuction: { kind: "sequence", calls: ["1NT"] },
        requiresCapabilities: [CAP_OPENING_1NT],
      }],
    },
  ],
  conflictPolicy: { activationDefault: "simultaneous" },
  priorityClassMapping: defaultPriorityClassMapping(),
};

/** Stayman-only sub-profile — natural NT responses + Stayman (no Jacoby Transfers). */
export const NT_STAYMAN_ONLY_PROFILE: SystemProfileIR = {
  profileId: "1nt-stayman-only",
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
        requiresCapabilities: [CAP_OPENING_1NT],
      }],
    },
  ],
  conflictPolicy: { activationDefault: "simultaneous" },
  priorityClassMapping: defaultPriorityClassMapping(),
};

/** Transfer-only sub-profile — natural NT responses + Jacoby Transfers (no Stayman). */
export const NT_TRANSFERS_ONLY_PROFILE: SystemProfileIR = {
  profileId: "1nt-transfers-only",
  baseSystem: "sayc",
  modules: [
    {
      moduleId: "natural-nt",
      kind: "base-system",
      attachments: [{ whenAuction: { kind: "sequence", calls: ["1NT"] } }],
    },
    {
      moduleId: "jacoby-transfers",
      kind: "add-on",
      attachments: [{
        whenAuction: { kind: "sequence", calls: ["1NT"] },
        requiresCapabilities: [CAP_OPENING_1NT],
      }],
    },
  ],
  conflictPolicy: { activationDefault: "simultaneous" },
  priorityClassMapping: defaultPriorityClassMapping(),
};
