import { staymanConfig } from "./stayman";
import { gerberConfig } from "./gerber";
import { bergenConfig } from "./bergen-raises";
import { dontConfig } from "./dont";
import { registerConvention } from "./registry";

registerConvention(staymanConfig);
registerConvention(gerberConfig);
registerConvention(bergenConfig);
registerConvention(dontConfig);
