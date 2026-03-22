import { resolveBundle, getBundleInput } from "../system-registry";
import { SAYC_SYSTEM_CONFIG } from "../../../core/contracts/system-config";

export const bergenBundle = resolveBundle(getBundleInput("bergen-bundle")!, SAYC_SYSTEM_CONFIG);
