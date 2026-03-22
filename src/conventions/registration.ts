// ── Side-effect registration ────────────────────────────────────────────
// Registers all convention bundles. Imported by the barrel (conventions/index.ts)
// as the FIRST import to ensure bundles are registered before any consumer access.
// Do not import this file directly — it is an internal implementation detail.

import { registerBundle } from "./core/bundle";
import { ntBundle } from "./definitions/nt-bundle";
import { ntStaymanBundle, ntTransfersBundle } from "./definitions/nt-bundle";
import { bergenBundle } from "./definitions/bergen-bundle";
import { weakTwoBundle } from "./definitions/weak-twos-bundle";
import { dontBundle } from "./definitions/dont-bundle";

registerBundle(ntBundle);
registerBundle(ntStaymanBundle);
registerBundle(ntTransfersBundle);
registerBundle(bergenBundle);
registerBundle(weakTwoBundle);
registerBundle(dontBundle);
