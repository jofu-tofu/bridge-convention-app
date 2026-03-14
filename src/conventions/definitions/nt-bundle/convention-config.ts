import { createConventionConfigFromBundle } from "../../core/bundle";
import { ConventionCategory } from "../../core/types";
import { ntBundle } from "./config";

export const ntBundleConventionConfig = createConventionConfigFromBundle(ntBundle, {
  name: "1NT Responses",
  description:
    "Full 1NT response system: Stayman + Jacoby Transfers + natural bids — practice choosing between conventions",
  categoryFallback: ConventionCategory.Asking,
});
