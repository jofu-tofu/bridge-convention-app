import { resolveBundle, getBundleInput } from "../system-registry";
import { SAYC_SYSTEM_CONFIG } from "../system-config";

export const ntBundle = resolveBundle(getBundleInput("nt-bundle")!, SAYC_SYSTEM_CONFIG);
