import { createSystemProfile } from "../../core/profile-builder";
import { BASE_SYSTEM_SAYC } from "../system-config";
import { CAP_OPENING_1NT } from "../capability-vocabulary";

export const NT_SAYC_PROFILE = createSystemProfile({
  baseSystem: BASE_SYSTEM_SAYC,
  profileId: "1nt-sayc",
  modules: [
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
    {
      moduleId: "smolen",
      kind: "add-on",
      attachments: [{
        whenAuction: { kind: "sequence", calls: ["1NT"] },
        requiresCapabilities: [CAP_OPENING_1NT],
      }],
    },
  ],
});

/** Stayman-only sub-profile — Stayman (no Jacoby Transfers). */
export const NT_STAYMAN_ONLY_PROFILE = createSystemProfile({
  baseSystem: BASE_SYSTEM_SAYC,
  profileId: "1nt-stayman-only",
  modules: [
    {
      moduleId: "stayman",
      kind: "add-on",
      attachments: [{
        whenAuction: { kind: "sequence", calls: ["1NT"] },
        requiresCapabilities: [CAP_OPENING_1NT],
      }],
    },
  ],
});

/** Transfer-only sub-profile — Jacoby Transfers (no Stayman). */
export const NT_TRANSFERS_ONLY_PROFILE = createSystemProfile({
  baseSystem: BASE_SYSTEM_SAYC,
  profileId: "1nt-transfers-only",
  modules: [
    {
      moduleId: "jacoby-transfers",
      kind: "add-on",
      attachments: [{
        whenAuction: { kind: "sequence", calls: ["1NT"] },
        requiresCapabilities: [CAP_OPENING_1NT],
      }],
    },
  ],
});
