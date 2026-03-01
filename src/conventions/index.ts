import { staymanConfig } from "./definitions/stayman";
import { bergenConfig } from "./definitions/bergen-raises";
import { saycConfig } from "./definitions/sayc";
import { weakTwosConfig } from "./definitions/weak-twos";
import { registerConvention } from "./core/registry";

registerConvention(staymanConfig);
registerConvention(bergenConfig);
registerConvention(saycConfig);
registerConvention(weakTwosConfig);
