import { resolveBundle, getBundleInput } from "../system-registry";
import { SAYC_SYSTEM_CONFIG } from "../../../core/contracts/system-config";

export const dontBundle = resolveBundle(getBundleInput("dont-bundle")!, SAYC_SYSTEM_CONFIG);
