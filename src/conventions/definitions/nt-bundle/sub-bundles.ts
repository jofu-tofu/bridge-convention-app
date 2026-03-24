import { resolveBundle, getBundleInput } from "../system-registry";
import { SAYC_SYSTEM_CONFIG } from "../system-config";

export const ntStaymanBundle = resolveBundle(getBundleInput("nt-stayman")!, SAYC_SYSTEM_CONFIG);
export const ntTransfersBundle = resolveBundle(getBundleInput("nt-transfers")!, SAYC_SYSTEM_CONFIG);
