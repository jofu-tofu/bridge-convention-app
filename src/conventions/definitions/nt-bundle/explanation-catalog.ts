// Re-export shim — explanation entries now live in each module.
import {
  createExplanationCatalog,
  type ExplanationCatalog,
} from "../../core/explanation-catalog";
import { createStaymanDeclarations } from "../modules/stayman";
import { createJacobyTransfersDeclarations } from "../modules/jacoby-transfers";
import { createSmolenDeclarations } from "../modules/smolen";
import { createNaturalBidsDeclarations } from "../modules/natural-nt";
import { SAYC_SYSTEM_CONFIG } from "../system-config";

const defaultSys = SAYC_SYSTEM_CONFIG;

export const NT_EXPLANATION_CATALOG: ExplanationCatalog =
  createExplanationCatalog([
    ...createNaturalBidsDeclarations(defaultSys).explanationEntries,
    ...createStaymanDeclarations(defaultSys).explanationEntries,
    ...createJacobyTransfersDeclarations(defaultSys).explanationEntries,
    ...createSmolenDeclarations(defaultSys).explanationEntries,
  ]);
