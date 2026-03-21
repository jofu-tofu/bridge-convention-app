// Re-export shim — explanation entries now live in each module.
import {
  createExplanationCatalog,
  type ExplanationCatalog,
} from "../../../core/contracts/explanation-catalog";
import { staymanModule } from "../modules/stayman";
import { jacobyTransfersModule } from "../modules/jacoby-transfers";
import { smolenModule } from "../modules/smolen";
import { naturalNtModule } from "../modules/natural-nt";

export const NT_EXPLANATION_CATALOG: ExplanationCatalog =
  createExplanationCatalog([
    ...naturalNtModule.explanationEntries,
    ...staymanModule.explanationEntries,
    ...jacobyTransfersModule.explanationEntries,
    ...smolenModule.explanationEntries,
  ]);
