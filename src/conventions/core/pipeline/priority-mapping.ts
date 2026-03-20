import type { PriorityClass } from "../../../core/contracts/agreement-module";
import type { RecommendationBand } from "../../../core/contracts/meaning";

/**
 * Map RecommendationBand to PriorityClass.
 *
 * RecommendationBand is the authored semantic priority on MeaningSurface (via RankingMetadata).
 * PriorityClass is the richer IR equivalent on DecisionSurfaceIR.
 */
export function bandToPriorityClass(band: RecommendationBand): PriorityClass {
  switch (band) {
    case "must":
      return "obligatory";
    case "should":
      return "preferredConventional";
    case "may":
      return "neutralCorrect";
    case "avoid":
      return "fallbackCorrect";
  }
}

/**
 * Map PriorityClass back to RecommendationBand for building RankingMetadata
 * from a DecisionSurfaceIR.
 */
export function priorityClassToBand(pc: PriorityClass | undefined): RecommendationBand {
  switch (pc) {
    case "obligatory":
      return "must";
    case "preferredConventional":
    case "preferredNatural":
      return "should";
    case "neutralCorrect":
      return "may";
    case "fallbackCorrect":
      return "avoid";
    default:
      return "should";
  }
}
