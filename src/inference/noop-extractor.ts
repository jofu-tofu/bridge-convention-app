import type { InferenceExtractor } from "./types";

/** No-op extractor for store use. Returns empty inferences;
 *  real inference flows through the posterior engine. */
export const noopExtractor: InferenceExtractor = {
  extractInferences() { return []; },
};
