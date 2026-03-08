import type { InferenceExtractor } from "./types";

/** No-op extractor for store use. The production inference path uses
 *  treeInferenceData DTOs via extractInferencesFromDTO() instead. */
export const noopExtractor: InferenceExtractor = {
  extractInferences() { return []; },
};
