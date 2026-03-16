import type { PedagogicalRelation } from "../../../core/contracts/pedagogical-relations";

export const NT_CROSS_MODULE_RELATIONS: readonly PedagogicalRelation[] = [
  { kind: "same-family", a: "stayman:ask-major", b: "transfer:to-hearts" },
  { kind: "same-family", a: "stayman:ask-major", b: "transfer:to-spades" },
  { kind: "fallback-of", a: "bridge:nt-invite", b: "stayman:ask-major" },
  { kind: "fallback-of", a: "bridge:to-3nt", b: "stayman:ask-major" },
  { kind: "near-miss-of", a: "stayman:ask-major", b: "transfer:to-hearts" },
  { kind: "stronger-than", a: "smolen:bid-short-hearts", b: "stayman:nt-invite-after-denial" },
  { kind: "stronger-than", a: "smolen:bid-short-spades", b: "stayman:nt-invite-after-denial" },
  { kind: "continuation-of", a: "smolen:bid-short-hearts", b: "stayman:ask-major" },
  { kind: "continuation-of", a: "smolen:bid-short-spades", b: "stayman:ask-major" },
  { kind: "near-miss-of", a: "smolen:bid-short-hearts", b: "stayman:nt-game-after-denial" },
  { kind: "near-miss-of", a: "smolen:bid-short-spades", b: "stayman:nt-game-after-denial" },
];

import { staymanModule } from "./modules/stayman";
import { jacobyTransfersModule } from "./modules/jacoby-transfers";
import { smolenModule } from "./modules/smolen";
import { naturalNtModule } from "./modules/natural-nt";

export const NT_PEDAGOGICAL_RELATIONS: readonly PedagogicalRelation[] = [
  ...naturalNtModule.pedagogicalRelations,
  ...staymanModule.pedagogicalRelations,
  ...jacobyTransfersModule.pedagogicalRelations,
  ...smolenModule.pedagogicalRelations,
  ...NT_CROSS_MODULE_RELATIONS,
];
