// Module barrel exports
// Re-export generic type + NT alias for backward compatibility
export type { ConventionModule } from "../../../core/composition/module-types";
export type { NtConventionModule } from "./module-types";

export { staymanModule, staymanFacts, STAYMAN_CLASSES, STAYMAN_R3_CLASSES, INTERFERENCE_CLASSES, INTERFERENCE_REDOUBLE_SURFACE, OPENER_STAYMAN_SURFACES, STAYMAN_R3_AFTER_2H_SURFACES, STAYMAN_R3_AFTER_2S_SURFACES, STAYMAN_R3_AFTER_2D_SURFACES } from "./stayman";
export { jacobyTransfersModule, transferFacts, TRANSFER_CLASSES, TRANSFER_R3_CLASSES, OPENER_TRANSFER_HEARTS_SURFACES, OPENER_TRANSFER_SPADES_SURFACES, TRANSFER_R3_HEARTS_SURFACES, TRANSFER_R3_SPADES_SURFACES } from "./jacoby-transfers";
export { smolenModule, smolenFacts, SMOLEN_CLASSES, createSmolenSubmachine, OPENER_SMOLEN_HEARTS_SURFACES, OPENER_SMOLEN_SPADES_SURFACES } from "./smolen";
export { naturalNtModule, ntResponseFacts, OPENER_1NT_SURFACE } from "./natural-nt";
