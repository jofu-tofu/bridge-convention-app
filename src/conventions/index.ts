import { registerConvention } from "./core/registry";
import { registerBundle } from "./core/bundle";
import { ntBundle } from "./definitions/nt-bundle";
import { ntBundleConventionConfig } from "./definitions/nt-bundle/convention-config";
import { bergenBundle } from "./definitions/bergen-bundle";
import { bergenBundleConventionConfig } from "./definitions/bergen-bundle/convention-config";

registerConvention(ntBundleConventionConfig);
registerConvention(bergenBundleConventionConfig);

registerBundle(ntBundle);
registerBundle(bergenBundle);
