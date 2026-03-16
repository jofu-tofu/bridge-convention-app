// Re-export shim — the conversation machine is now composed bottom-up.
import type { ConversationMachine } from "../../core/runtime/machine-types";
import { composeNtModules } from "./compose";
import { staymanModule } from "./modules/stayman";
import { jacobyTransfersModule } from "./modules/jacoby-transfers";
import { smolenModule } from "./modules/smolen";
import { naturalNtModule } from "./modules/natural-nt";
import { NT_CROSS_MODULE_RELATIONS } from "./pedagogical-relations";

export { createSmolenSubmachine } from "./modules/smolen";

export function createNtConversationMachine(): ConversationMachine {
  const composed = composeNtModules(
    [naturalNtModule, jacobyTransfersModule, staymanModule, smolenModule],
    NT_CROSS_MODULE_RELATIONS,
  );
  return composed.conversationMachine;
}
