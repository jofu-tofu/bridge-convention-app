import { staymanConfig } from "./definitions/stayman";
import { gerberConfig } from "./definitions/gerber";
import { bergenConfig } from "./definitions/bergen-raises";
import { dontConfig } from "./definitions/dont";
import { landyConfig } from "./definitions/landy";
import { saycConfig } from "./definitions/sayc";
import { registerConvention } from "./core/registry";

registerConvention(staymanConfig);
registerConvention(gerberConfig);
registerConvention(bergenConfig);
registerConvention(dontConfig);
registerConvention(landyConfig);
registerConvention(saycConfig);
