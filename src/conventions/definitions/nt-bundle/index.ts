export { ntBundle } from "./config";
export { ntBundleConventionConfig } from "./convention-config";
export { ntStaymanBundle, ntTransfersBundle } from "./sub-bundles";
export { ntCrossConventionAlternatives } from "./alternatives";
export { NT_PEDAGOGICAL_RELATIONS } from "./pedagogical-relations";
export { staymanFacts } from "../modules/stayman";
export { transferFacts } from "../modules/jacoby-transfers";
export { ntResponseFacts } from "../modules/natural-nt";
export {
  RESPONDER_SURFACES,
  OPENER_STAYMAN_SURFACES,
  OPENER_TRANSFER_HEARTS_SURFACES,
  INTERFERENCE_REDOUBLE_SURFACE,
  STAYMAN_R3_AFTER_2D_SURFACES,
} from "./composed-surfaces";
export { NT_SAYC_PROFILE } from "./system-profile";
export { NT_EXPLANATION_CATALOG } from "./explanation-catalog";

// New bottom-up module exports
export { staymanModule } from "../modules/stayman";
export { jacobyTransfersModule } from "../modules/jacoby-transfers";
export { smolenModule } from "../modules/smolen";
export { naturalNtModule } from "../modules/natural-nt";
// compose.ts removed — protocol frame architecture replaces module composition

