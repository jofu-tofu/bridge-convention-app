import { resolveBundle, getBundleInput } from "../system-registry";
import { SAYC_SYSTEM_CONFIG } from "../system-config";

export const weakTwoBundle = resolveBundle(getBundleInput("weak-twos-bundle")!, SAYC_SYSTEM_CONFIG);
