import { createConventionConfigFromBundle } from "../../core/bundle";
import { ConventionCategory } from "../../core/types";
import { bergenBundle } from "./config";

export const bergenBundleConventionConfig = createConventionConfigFromBundle(bergenBundle, {
  name: "Bergen Raises (Bundle)",
  description:
    "Bergen Raises via the meaning pipeline — constructive, limit, game, preemptive, and splinter raises after 1M opening",
  categoryFallback: ConventionCategory.Constructive,
});
