import { registerConvention } from "./core/registry";
import { registerBundle } from "./core/bundle";
import { ntBundle } from "./definitions/nt-bundle";
import { ntStaymanBundle, ntTransfersBundle } from "./definitions/nt-bundle";
import {
  ntBundleConventionConfig,
  ntStaymanConventionConfig,
  ntTransfersConventionConfig,
} from "./definitions/nt-bundle/convention-config";
import { bergenBundle } from "./definitions/bergen-bundle";
import { bergenBundleConventionConfig } from "./definitions/bergen-bundle/convention-config";

registerConvention(ntBundleConventionConfig);
registerConvention(ntStaymanConventionConfig);
registerConvention(ntTransfersConventionConfig);
registerConvention(bergenBundleConventionConfig);

registerBundle(ntBundle);
registerBundle(ntStaymanBundle);
registerBundle(ntTransfersBundle);
registerBundle(bergenBundle);
