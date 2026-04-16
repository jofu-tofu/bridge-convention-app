const BUNDLE_ID_ALIASES: Readonly<Record<string, string>> = {
  "nt-stayman": "stayman-bundle",
  "nt-transfers": "jacoby-transfers-bundle",
};

export function canonicalBundleId(id: string): string {
  return BUNDLE_ID_ALIASES[id] ?? id;
}
