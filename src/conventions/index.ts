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
