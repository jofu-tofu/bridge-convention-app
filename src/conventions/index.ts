import { staymanConfig } from "./stayman";
import { gerberConfig } from "./gerber";
import { bergenConfig } from "./bergen-raises";
import { dontConfig } from "./dont";
import { saycConfig } from "./sayc";
import { registerConvention } from "./registry";

registerConvention(staymanConfig);
registerConvention(gerberConfig);
registerConvention(bergenConfig);
registerConvention(dontConfig);
registerConvention(saycConfig);
