use crate::billing::entitlements::{SubscriptionTier, FREE_BUNDLE_IDS};

/// Canonical bundle IDs known to the server. Mirrors the IDs the client
/// produces after `canonicalBundleId()` runs (see
/// `src/components/screens/landing/landing-helpers.ts`). Add new entries
/// here when shipping a new bundle.
const KNOWN_BUNDLE_IDS: &[&str] = &[
    "nt-bundle",
    "stayman-bundle",
    "jacoby-transfers-bundle",
    "smolen-bundle",
    "blackwood-bundle",
    "strong-2c-bundle",
    "weak-twos-bundle",
    "bergen-bundle",
    "dont-bundle",
    "michaels-unusual-bundle",
    "negative-doubles-bundle",
    "nmf-bundle",
    "jacoby-4way-bundle",
    "stayman-garbage-bundle",
];

/// Bare module IDs accepted as drill members. Mirrors the fixture file
/// names under `crates/bridge-conventions/fixtures/modules/`.
const KNOWN_MODULE_IDS: &[&str] = &[
    "natural-bids",
    "natural-competitive",
    "stayman",
    "stayman-garbage",
    "jacoby-transfers",
    "jacoby-4way",
    "smolen",
    "blackwood",
    "strong-2c",
    "weak-twos",
    "bergen",
    "dont",
    "michaels-unusual",
    "negative-doubles",
    "new-minor-forcing",
];

/// Returns the subset of `module_ids` that the server does not recognize.
/// `user:*` IDs are accepted as opaque — they refer to per-user
/// device-local modules that the server cannot validate.
pub fn unknown_modules(module_ids: &[String]) -> Vec<String> {
    module_ids
        .iter()
        .filter(|id| !is_known_module(id))
        .cloned()
        .collect()
}

fn is_known_module(id: &str) -> bool {
    if id.starts_with("user:") {
        return true;
    }
    KNOWN_BUNDLE_IDS.iter().any(|known| *known == id)
        || KNOWN_MODULE_IDS.iter().any(|known| *known == id)
}

/// Returns the subset of `module_ids` that the given tier may NOT practice.
/// Paid tiers always pass; free/expired tiers are gated against
/// `FREE_BUNDLE_IDS`.
pub fn blocked_modules(tier: SubscriptionTier, module_ids: &[String]) -> Vec<String> {
    if tier == SubscriptionTier::Paid {
        return Vec::new();
    }
    module_ids
        .iter()
        .filter(|id| !is_free(id))
        .cloned()
        .collect()
}

fn is_free(id: &str) -> bool {
    if id.starts_with("user:") {
        return true;
    }
    FREE_BUNDLE_IDS.iter().any(|free| *free == id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_modules_flags_truly_unknown_ids() {
        let result = unknown_modules(&[
            "stayman-bundle".into(),
            "nt-stayman".into(), // legacy alias — server does not migrate
            "stayman".into(),
        ]);
        assert_eq!(result, vec!["nt-stayman".to_string()]);
    }

    #[test]
    fn unknown_modules_accepts_user_prefix() {
        let result = unknown_modules(&["user:abc".into()]);
        assert!(result.is_empty());
    }

    #[test]
    fn blocked_modules_empty_for_paid() {
        let result = blocked_modules(SubscriptionTier::Paid, &["bergen-bundle".into()]);
        assert!(result.is_empty());
    }

    #[test]
    fn blocked_modules_lists_paid_bundles_for_free() {
        let result = blocked_modules(
            SubscriptionTier::Free,
            &[
                "stayman-bundle".into(),
                "bergen-bundle".into(),
                "dont-bundle".into(),
            ],
        );
        assert_eq!(
            result,
            vec!["bergen-bundle".to_string(), "dont-bundle".to_string()]
        );
    }

    #[test]
    fn blocked_modules_treats_expired_as_free() {
        let result = blocked_modules(SubscriptionTier::Expired, &["bergen-bundle".into()]);
        assert_eq!(result, vec!["bergen-bundle".to_string()]);
    }
}
